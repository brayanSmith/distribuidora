export type PixelCrop = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type Opciones = {
    /** The source's type: PNG/WebP/GIF keep their transparency (as PNG); the rest go as JPEG. */
    tipoOriginal?: string;
    /** The longest side of the result, in px; bigger crops are scaled down. */
    maxLado?: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (event) => reject(event));
        image.crossOrigin = 'anonymous';
        image.src = src;
    });
}

/** Whether the image can have transparent parts, which JPEG would turn black. */
function admiteTransparencia(tipo: string | undefined): boolean {
    return ['image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(
        tipo ?? '',
    );
}

export async function getCroppedImageFile(
    imageSrc: string,
    crop: PixelCrop,
    fileName: string,
    { tipoOriginal, maxLado }: Opciones = {},
): Promise<File> {
    const image = await loadImage(imageSrc);
    const escala = maxLado
        ? Math.min(1, maxLado / Math.max(crop.width, crop.height))
        : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(crop.width * escala);
    canvas.height = Math.round(crop.height * escala);

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('No se pudo procesar la imagen.');
    }

    const tipo = admiteTransparencia(tipoOriginal) ? 'image/png' : 'image/jpeg';

    // Zoomed out, the crop is bigger than the image: the margin stays
    // transparent in PNG and white (not black) in JPEG.
    if (tipo === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.imageSmoothingQuality = 'high';
    context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, tipo, 0.92),
    );

    if (!blob) {
        throw new Error('No se pudo procesar la imagen.');
    }

    const nombre = fileName.replace(
        /\.[^.]+$/,
        tipo === 'image/png' ? '.png' : '.jpg',
    );

    return new File([blob], nombre, { type: tipo });
}
