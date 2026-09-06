import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

/**
 * Identité cryptographique ESP — Ed25519.
 *
 * INVARIANT : CLE_IDENTITE_ESP ≠ CLE_WALLET_SOLANA
 * Cette clé ne doit JAMAIS être réutilisée comme clé financière.
 *
 * Les clés sont générées par un CSPRNG — jamais dérivées de graineSimulation.
 */

export const ALGORITHME_IDENTITE_ESP = "ed25519" as const;
export const VERSION_IDENTITE_ESP = "0.1.0" as const;

export type PaireIdentiteEd25519 = {
  /** Clé privée PKCS8 DER — jamais dans le registre / API / logs. */
  readonly clePriveePkcs8Der: Buffer;
  /** Clé publique brute 32 octets. */
  readonly clePubliqueBrute: Buffer;
  /** Encodage canonique base64url de la clé publique brute. */
  readonly clePubliqueBase64Url: string;
  /** SHA-256 hex de la clé publique brute. */
  readonly empreinteClePublique: string;
};

export class IdentiteEspErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentiteEspErreur";
  }
}

export function genererPaireIdentiteEd25519(): PaireIdentiteEd25519 {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const clePriveePkcs8Der = privateKey.export({
    type: "pkcs8",
    format: "der",
  });
  const clePubliqueBrute = extraireClePubliqueBrute(publicKey);
  return {
    clePriveePkcs8Der: Buffer.from(clePriveePkcs8Der),
    clePubliqueBrute,
    clePubliqueBase64Url: encoderBase64Url(clePubliqueBrute),
    empreinteClePublique: calculerEmpreinteClePublique(clePubliqueBrute),
  };
}

export function calculerEmpreinteClePublique(
  clePubliqueBruteOuBase64Url: Buffer | string,
): string {
  const brute =
    typeof clePubliqueBruteOuBase64Url === "string"
      ? decoderBase64Url(clePubliqueBruteOuBase64Url)
      : clePubliqueBruteOuBase64Url;
  return createHash("sha256").update(brute).digest("hex");
}

export function signerOctetsAvecPkcs8(
  clePriveePkcs8Der: Buffer,
  message: Buffer | Uint8Array,
): Buffer {
  const cle = createPrivateKey({
    key: clePriveePkcs8Der,
    format: "der",
    type: "pkcs8",
  });
  return sign(null, Buffer.from(message), cle);
}

export function verifierSignatureEd25519(options: {
  readonly clePubliqueBase64Url: string;
  readonly message: Buffer | Uint8Array;
  readonly signatureBase64Url: string;
}): boolean {
  try {
    const clePublique = recreerClePubliqueDepuisBase64Url(
      options.clePubliqueBase64Url,
    );
    const signature = decoderBase64Url(options.signatureBase64Url);
    return verify(null, Buffer.from(options.message), clePublique, signature);
  } catch {
    return false;
  }
}

export function recreerClePubliqueDepuisBase64Url(
  clePubliqueBase64Url: string,
): KeyObject {
  const brute = decoderBase64Url(clePubliqueBase64Url);
  if (brute.length !== 32) {
    throw new IdentiteEspErreur(
      `Clé publique Ed25519 invalide : ${String(brute.length)} octets`,
    );
  }
  // JWK OKP Ed25519 — reconstruit une KeyObject sans dépendre d'un format PEM.
  return createPublicKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      x: clePubliqueBase64Url,
    },
    format: "jwk",
  });
}

export function extraireClePubliqueDepuisPkcs8(
  clePriveePkcs8Der: Buffer,
): {
  readonly clePubliqueBrute: Buffer;
  readonly clePubliqueBase64Url: string;
  readonly empreinteClePublique: string;
} {
  const privee = createPrivateKey({
    key: clePriveePkcs8Der,
    format: "der",
    type: "pkcs8",
  });
  const publique = createPublicKey(privee);
  const clePubliqueBrute = extraireClePubliqueBrute(publique);
  return {
    clePubliqueBrute,
    clePubliqueBase64Url: encoderBase64Url(clePubliqueBrute),
    empreinteClePublique: calculerEmpreinteClePublique(clePubliqueBrute),
  };
}

export function encoderBase64Url(octets: Buffer): string {
  return octets
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function decoderBase64Url(texte: string): Buffer {
  const pad = (4 - (texte.length % 4)) % 4;
  const base64 =
    texte.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad);
  return Buffer.from(base64, "base64");
}

function extraireClePubliqueBrute(publique: KeyObject): Buffer {
  const jwk = publique.export({ format: "jwk" });
  if (typeof jwk.x !== "string" || jwk.x.length === 0) {
    throw new IdentiteEspErreur("Export JWK Ed25519 sans champ x");
  }
  return decoderBase64Url(jwk.x);
}
