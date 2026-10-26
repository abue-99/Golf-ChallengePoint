// Generates a VAPID key pair for web push. Put both lines into the .env on
// the server (once – changing them invalidates all device subscriptions).
import { createECDH } from "node:crypto";

const b64url = (buffer) =>
  buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log(`VAPID_PUBLIC_KEY=${b64url(ecdh.getPublicKey())}`);
console.log(`VAPID_PRIVATE_KEY=${b64url(ecdh.getPrivateKey())}`);
