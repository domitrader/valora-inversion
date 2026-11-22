const BIOMETRIC_CREDENTIAL_KEY = 'domingo_biometric_cred_id';

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const biometricService = {
  /**
   * Comprueba si el navegador/dispositivo soporta WebAuthn (Huella / Face ID / Windows Hello)
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!window.PublicKeyCredential) return false;
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  },

  isEnabled(): boolean {
    try {
      return !!localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
    } catch {
      return false;
    }
  },

  disable(): void {
    try {
      localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
    } catch {}
  },

  /**
   * Registra la huella o Face ID del dispositivo actual usando WebAuthn
   */
  async register(userName: string = 'Domingo'): Promise<boolean> {
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Portafolio Privado',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: userName,
            displayName: userName,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (credential && credential.rawId) {
        localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, bufferToBase64Url(credential.rawId));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Registro biométrico cancelado o no disponible:', e);
      return false;
    }
  },

  /**
   * Solicita verificación biométrica (huella/Face ID/Windows Hello) para desbloquear
   */
  async authenticate(): Promise<boolean> {
    try {
      const storedId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
      if (!storedId) return false;

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [
            {
              type: 'public-key',
              id: base64UrlToBuffer(storedId),
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      });

      return Boolean(assertion);
    } catch (e) {
      console.warn('Autenticación biométrica cancelada o fallida:', e);
      return false;
    }
  },
};
