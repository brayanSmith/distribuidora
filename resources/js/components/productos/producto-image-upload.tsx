import { ImagePlus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import type { ProductoImagen } from '@/types';

type Props = {
    /** Images the producto already has (edit only). */
    existentes?: ProductoImagen[];
    errors: Partial<Record<string, string>>;
};

type NuevaImagen = { file: File; preview: string };

export default function ProductoImageUpload({
    existentes = [],
    errors,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [nuevas, setNuevas] = useState<NuevaImagen[]>([]);
    const [quitadas, setQuitadas] = useState<number[]>([]);

    // The form submits whatever the hidden file input holds, so it is kept in
    // sync with the images chosen here.
    useEffect(() => {
        if (!fileInputRef.current) {
            return;
        }

        const dataTransfer = new DataTransfer();
        nuevas.forEach(({ file }) => dataTransfer.items.add(file));
        fileInputRef.current.files = dataTransfer.files;
    }, [nuevas]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setNuevas((actuales) => [
            ...actuales,
            ...acceptedFiles.map((file) => ({
                file,
                preview: URL.createObjectURL(file),
            })),
        ]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        multiple: true,
    });

    const quitarNueva = (preview: string) => {
        URL.revokeObjectURL(preview);
        setNuevas((actuales) =>
            actuales.filter((imagen) => imagen.preview !== preview),
        );
    };

    const visibles = existentes.filter(({ id }) => !quitadas.includes(id));
    const mensajes = Object.entries(errors)
        .filter(([campo]) => campo.startsWith('imagenes'))
        .map(([, mensaje]) => mensaje);

    return (
        <div className="space-y-3">
            <div
                {...getRootProps()}
                className={cn(
                    'cursor-pointer rounded-md border-2 border-dashed transition-colors',
                    isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-input hover:bg-accent/50',
                )}
            >
                <input {...getInputProps()} />

                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <ImagePlus className="h-8 w-8" />
                    <span className="text-sm">
                        Arrastra imágenes o haz clic
                    </span>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                name="imagenes[]"
                multiple
                className="hidden"
            />
            {quitadas.map((id) => (
                <input
                    key={id}
                    type="hidden"
                    name="remove_imagen_ids[]"
                    value={id}
                />
            ))}

            {visibles.length + nuevas.length > 0 ? (
                <div
                    className="grid grid-cols-2 gap-2"
                    data-test="producto-imagenes"
                >
                    {visibles.map((imagen) => (
                        <Miniatura
                            key={`imagen-${imagen.id}`}
                            src={imagen.url}
                            onRemove={() =>
                                setQuitadas((actuales) => [
                                    ...actuales,
                                    imagen.id,
                                ])
                            }
                        />
                    ))}
                    {nuevas.map((imagen) => (
                        <Miniatura
                            key={imagen.preview}
                            src={imagen.preview}
                            onRemove={() => quitarNueva(imagen.preview)}
                        />
                    ))}
                </div>
            ) : null}

            {mensajes.map((mensaje) => (
                <p key={mensaje} className="text-destructive text-sm">
                    {mensaje}
                </p>
            ))}
        </div>
    );
}

function Miniatura({ src, onRemove }: { src: string; onRemove: () => void }) {
    return (
        <div className="relative">
            <img
                src={src}
                alt=""
                className="aspect-square w-full rounded-md border object-contain"
            />
            <button
                type="button"
                aria-label="Eliminar imagen"
                data-test="producto-imagen-remove"
                className="bg-background/90 text-destructive hover:bg-destructive/10 absolute top-1 right-1 rounded-full border p-1"
                onClick={onRemove}
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
