import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProductoImagen } from '@/types';

type Props = {
    /** Images the producto already has (edit only), in their saved order. */
    existentes?: ProductoImagen[];
    errors: Partial<Record<string, string>>;
};

/** An image of the list: one already saved, or a file picked in this form. */
type Item =
    | { kind: 'existente'; id: number; src: string }
    | { kind: 'nueva'; file: File; src: string };

export default function ProductoImageUpload({
    existentes = [],
    errors,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [items, setItems] = useState<Item[]>(() =>
        existentes.map(
            ({ id, url }): Item => ({ kind: 'existente', id, src: url }),
        ),
    );
    const [quitadas, setQuitadas] = useState<number[]>([]);

    // The form submits whatever the hidden file input holds, so it carries the
    // new files in the same order they have in the list.
    useEffect(() => {
        if (!fileInputRef.current) {
            return;
        }

        const dataTransfer = new DataTransfer();
        items.forEach((item) => {
            if (item.kind === 'nueva') {
                dataTransfer.items.add(item.file);
            }
        });
        fileInputRef.current.files = dataTransfer.files;
    }, [items]);

    // `e<id>` for a saved image, `n<index>` for the n-th new file: the final
    // order the server applies.
    let indiceNueva = 0;
    const orden = items.map((item) =>
        item.kind === 'existente' ? `e${item.id}` : `n${indiceNueva++}`,
    );

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setItems((actuales) => [
            ...actuales,
            ...acceptedFiles.map(
                (file): Item => ({
                    kind: 'nueva',
                    file,
                    src: URL.createObjectURL(file),
                }),
            ),
        ]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        multiple: true,
    });

    const mover = (indice: number, direccion: -1 | 1) =>
        setItems((actuales) => {
            const destino = indice + direccion;

            if (destino < 0 || destino >= actuales.length) {
                return actuales;
            }

            const copia = [...actuales];
            [copia[indice], copia[destino]] = [copia[destino], copia[indice]];

            return copia;
        });

    const quitar = (indice: number) => {
        const item = items[indice];

        if (item.kind === 'existente') {
            setQuitadas((actuales) => [...actuales, item.id]);
        } else {
            URL.revokeObjectURL(item.src);
        }

        setItems((actuales) => actuales.filter((_, i) => i !== indice));
    };

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
            {orden.map((ficha) => (
                <input
                    key={ficha}
                    type="hidden"
                    name="orden_imagenes[]"
                    value={ficha}
                />
            ))}

            {items.length > 0 ? (
                <>
                    <p className="text-muted-foreground text-xs">
                        La primera imagen es la principal. Usa las flechas para
                        cambiar el orden.
                    </p>
                    <div
                        className="grid grid-cols-2 gap-2"
                        data-test="producto-imagenes"
                    >
                        {items.map((item, indice) => (
                            <Miniatura
                                key={
                                    item.kind === 'existente'
                                        ? `e${item.id}`
                                        : item.src
                                }
                                src={item.src}
                                principal={indice === 0}
                                puedeSubir={indice > 0}
                                puedeBajar={indice < items.length - 1}
                                onMove={(direccion) => mover(indice, direccion)}
                                onRemove={() => quitar(indice)}
                            />
                        ))}
                    </div>
                </>
            ) : null}

            {mensajes.map((mensaje) => (
                <p key={mensaje} className="text-destructive text-sm">
                    {mensaje}
                </p>
            ))}
        </div>
    );
}

function Miniatura({
    src,
    principal,
    puedeSubir,
    puedeBajar,
    onMove,
    onRemove,
}: {
    src: string;
    principal: boolean;
    puedeSubir: boolean;
    puedeBajar: boolean;
    onMove: (direccion: -1 | 1) => void;
    onRemove: () => void;
}) {
    return (
        <div className="relative">
            <img
                src={src}
                alt=""
                className="aspect-square w-full rounded-md border object-contain"
            />
            {principal ? (
                <Badge className="absolute top-1 left-1">Principal</Badge>
            ) : null}
            <button
                type="button"
                aria-label="Eliminar imagen"
                data-test="producto-imagen-remove"
                className="bg-background/90 text-destructive hover:bg-destructive/10 absolute top-1 right-1 rounded-full border p-1"
                onClick={onRemove}
            >
                <X className="h-4 w-4" />
            </button>
            <div className="absolute right-1 bottom-1 left-1 flex justify-between">
                <button
                    type="button"
                    aria-label="Mover antes"
                    data-test="producto-imagen-antes"
                    disabled={!puedeSubir}
                    className="bg-background/90 hover:bg-accent rounded-full border p-1 disabled:opacity-30"
                    onClick={() => onMove(-1)}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    aria-label="Mover después"
                    data-test="producto-imagen-despues"
                    disabled={!puedeBajar}
                    className="bg-background/90 hover:bg-accent rounded-full border p-1 disabled:opacity-30"
                    onClick={() => onMove(1)}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
