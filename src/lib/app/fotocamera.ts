// Fotocamera: nell'app usa il plugin nativo (qualita' e orientamento corretti,
// permessi del sistema); sul web restituisce null e si usa l'input file.

import { isNativa } from './nativa';

/** Converte i dati base64 del plugin in un File pronto per il caricamento. */
export function fileDaBase64(base64: string, formato: string, nome = 'foto'): File {
  const binario = atob(base64);
  const byte = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) byte[i] = binario.charCodeAt(i);
  const tipo = formato === 'png' ? 'image/png' : 'image/jpeg';
  const est = formato === 'png' ? 'png' : 'jpg';
  return new File([byte], `${nome}-${Date.now()}.${est}`, { type: tipo });
}

/**
 * Scatta una foto con la fotocamera del telefono (o la sceglie dalla galleria,
 * a scelta dell'utente). Restituisce null sul web, se l'utente annulla o se il
 * permesso e' negato: chi chiama ripiega sull'input file.
 */
export async function scattaFoto(): Promise<File | null> {
  if (!isNativa()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const foto = await Camera.getPhoto({
      quality: 82,
      width: 2000,
      correctOrientation: true,
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      promptLabelHeader: 'Foto',
      promptLabelPhoto: 'Scegli dalla galleria',
      promptLabelPicture: 'Scatta una foto',
      promptLabelCancel: 'Annulla',
      saveToGallery: false,
    });
    if (!foto.base64String) return null;
    return fileDaBase64(foto.base64String, foto.format);
  } catch {
    return null;
  }
}

/**
 * Apre la fotocamera nativa nell'app; sul web (o se il plugin non risponde)
 * apre l'input file indicato.
 */
export async function fotoOppureInput(
  input: HTMLInputElement | null,
  usa: (f: File) => void | Promise<void>
): Promise<void> {
  if (isNativa()) {
    const f = await scattaFoto();
    if (f) await usa(f);
    return;
  }
  input?.click();
}
