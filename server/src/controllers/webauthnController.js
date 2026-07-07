import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import User from '../models/User.js'
import {
  RP_NAME,
  RP_ID,
  ORIGIN,
  storeRegChallenge,
  takeRegChallenge,
  storeAuthChallenge,
  takeAuthChallenge,
} from '../services/webauthnService.js'
import { signAccessToken, createRefreshSession } from '../services/tokenService.js'
import { setRefreshCookie } from '../utils/cookies.js'
import { logAction } from '../services/auditService.js'

// base64url <-> Buffer helpers (Node Buffer supports 'base64url')
const toBuffer = (b64url) => Buffer.from(b64url, 'base64url')
const fromBuffer = (buf) => Buffer.from(buf).toString('base64url')

// ---- Registration (user is authenticated) ----

export async function registerOptions(req, res) {
  const user = req.user

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(String(user._id)),
    userName: user.email,
    userDisplayName: user.profile?.name || user.email,
    attestationType: 'none',
    // don't let the same authenticator register twice
    excludeCredentials: user.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  await storeRegChallenge(String(user._id), options.challenge)
  res.json(options)
}

export async function registerVerify(req, res) {
  const user = req.user
  const expectedChallenge = await takeRegChallenge(String(user._id))
  if (!expectedChallenge) return res.status(400).json({ error: 'no pending registration challenge' })

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: req.body.attestation,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'passkey registration could not be verified' })
  }

  const { credential } = verification.registrationInfo
  // guard against double-registering the same credential
  if (user.passkeys.some((p) => p.credentialId === credential.id)) {
    return res.status(409).json({ error: 'this passkey is already registered' })
  }

  user.passkeys.push({
    credentialId: credential.id,
    publicKey: fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
    name: req.body.name || 'Passkey',
  })
  await user.save()

  await logAction({ actor: user._id, role: user.role, action: 'passkey_register', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })
  res.json({ verified: true })
}

// ---- Authentication (pre-auth, usernameless/discoverable) ----

export async function loginOptions(req, res) {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    // empty allowCredentials => discoverable-credential (usernameless) login
  })

  const challengeHandle = await storeAuthChallenge(options.challenge)
  res.json({ options, challengeHandle })
}

export async function loginVerify(req, res) {
  const { assertion, challengeHandle } = req.body
  if (!assertion || !challengeHandle) return res.status(400).json({ error: 'assertion and challengeHandle are required' })

  const expectedChallenge = await takeAuthChallenge(challengeHandle)
  if (!expectedChallenge) return res.status(400).json({ error: 'challenge expired, try again' })

  // the assertion carries the credential id; find whichever user owns it
  const credentialId = assertion.id
  const user = await User.findOne({ 'passkeys.credentialId': credentialId })
  if (!user) return res.status(401).json({ error: 'unknown passkey' })

  const passkey = user.passkeys.find((p) => p.credentialId === credentialId)

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey: toBuffer(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    })
  } catch (err) {
    return res.status(401).json({ error: err.message })
  }

  if (!verification.verified) {
    await logAction({ actor: user._id, role: user.role, action: 'passkey_login', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'failure' })
    return res.status(401).json({ error: 'passkey verification failed' })
  }

  // persist the rotated signature counter to detect cloned authenticators
  passkey.counter = verification.authenticationInfo.newCounter
  await user.save()

  const accessToken = signAccessToken(user)
  const refreshToken = await createRefreshSession(String(user._id), req.ip)
  setRefreshCookie(res, refreshToken)

  await logAction({ actor: user._id, role: user.role, action: 'passkey_login', resourceType: 'User', resourceId: user._id, ip: req.ip, status: 'success' })
  res.json({ accessToken, user: { id: user._id, email: user.email, role: user.role } })
}

// ---- Management (authenticated) ----

export async function listPasskeys(req, res) {
  res.json(
    req.user.passkeys.map((p) => ({ id: p._id, name: p.name, createdAt: p.createdAt })),
  )
}

export async function deletePasskey(req, res) {
  const before = req.user.passkeys.length
  req.user.passkeys = req.user.passkeys.filter((p) => String(p._id) !== req.params.id)
  if (req.user.passkeys.length === before) return res.status(404).json({ error: 'passkey not found' })
  await req.user.save()
  await logAction({ actor: req.user._id, role: req.user.role, action: 'passkey_delete', resourceType: 'User', resourceId: req.user._id, ip: req.ip, status: 'success' })
  res.json({ message: 'passkey removed' })
}
