import { ImagePlus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Area } from 'react-easy-crop';
import Cropper from 'react-easy-crop';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getCroppedImageFile } from '@/lib/crop-image';
import { cn } from '@/lib/utils';

/** A shape the image can be cropped to. */
export type FormatoRecorte = {
    value: string;
    label: string;
    /** Width / height; null keeps the image's own shape (nothing cut). */
    aspecto: number | null;
};

export const RECORTE_CUADRADO: FormatoRecorte = {
    value: 'CUADRADO',
    label: 'Cuadrado',
    aspecto: 1,
};

type Props = {
    label: string;
    value?: string | null;
    onChange: (file: File | null, removed: boolean) => void;
    error?: string;
    /** The shapes to choose from; one alone is used without asking. Square by default. */
    formatos?: FormatoRecorte[];
    /** The shape chosen first (the one the current image has). */
    formatoInicial?: string;
    /** The shape applied, and its width / height. */
    onFormatoChange?: (formato: string, aspecto: number) => void;
    /** The longest side of the uploaded image, in px. */
    maxLado?: number;
};

export default function ImageDropCropper({
    label,
    value,
    onChange,
    error,
    formatos = [RECORTE_CUADRADO],
    formatoInicial,
    onFormatoChange,
    maxLado,
}: Props) {
    const [preview, setPreview] = useState<string | null>(value ?? null);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [tipoOriginal, setTipoOriginal] = useState<string>('');
    const [cropOpen, setCropOpen] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
        null,
    );
    const [formato, setFormato] = useState(
        formatos.find((opcion) => opcion.value === formatoInicial)?.value ??
            formatos[0].value,
    );
    /** The shape of the loaded image, for the "keep its shape" option. */
    const [aspectoImagen, setAspectoImagen] = useState(1);
    /** The shape the preview box takes (the last image applied). */
    const [aspectoPreview, setAspectoPreview] = useState(
        formatos.find((opcion) => opcion.value === formato)?.aspecto ?? 1,
    );

    const elegido =
        formatos.find((opcion) => opcion.value === formato) ?? formatos[0];
    const aspecto = elegido.aspecto ?? aspectoImagen;

    useEffect(() => {
        setPreview(value ?? null);
    }, [value]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];

        if (!file) {
            return;
        }

        setCropSrc(URL.createObjectURL(file));
        setTipoOriginal(file.type);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCropOpen(true);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 1,
        multiple: false,
    });

    const closeCropDialog = () => {
        setCropOpen(false);

        if (cropSrc) {
            URL.revokeObjectURL(cropSrc);
        }

        setCropSrc(null);
    };

    const applyCrop = async () => {
        if (!cropSrc || !croppedAreaPixels) {
            return;
        }

        const file = await getCroppedImageFile(
            cropSrc,
            croppedAreaPixels,
            'imagen.jpg',
            { tipoOriginal, maxLado },
        );

        setPreview(URL.createObjectURL(file));
        setAspectoPreview(aspecto);
        onChange(file, false);
        onFormatoChange?.(formato, aspecto);
        closeCropDialog();
    };

    const removeImage = (event: React.MouseEvent) => {
        event.stopPropagation();
        setPreview(null);
        onChange(null, true);
    };

    return (
        <div className="grid gap-2">
            <Label>{label}</Label>

            <div
                {...getRootProps()}
                className={cn(
                    'relative flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed transition-colors',
                    // Wide images get a wide box, so the preview is not cut.
                    aspectoPreview > 1.3 ? 'w-72 max-w-full' : 'w-40',
                    isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-input hover:bg-accent/50',
                )}
            >
                <input {...getInputProps()} />

                {preview ? (
                    <>
                        <img
                            src={preview}
                            alt=""
                            className="h-full w-full object-contain"
                        />
                        <button
                            type="button"
                            onClick={removeImage}
                            data-test="image-remove-button"
                            className="bg-background/80 text-foreground hover:bg-background absolute top-1 right-1 rounded-full p-1"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    <div className="text-muted-foreground flex flex-col items-center gap-1 px-2 text-center">
                        <ImagePlus className="h-6 w-6" />
                        <span className="text-xs">
                            Arrastra una imagen o haz clic
                        </span>
                    </div>
                )}
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <Dialog
                open={cropOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeCropDialog();
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Ajustar imagen</DialogTitle>
                        <DialogDescription>
                            Arrastra la imagen y usa el zoom para elegir qué
                            parte queda.
                        </DialogDescription>
                    </DialogHeader>

                    {formatos.length > 1 ? (
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={formato}
                            onValueChange={(valor) => {
                                if (valor) {
                                    setFormato(valor);
                                    setCrop({ x: 0, y: 0 });
                                    setZoom(1);
                                }
                            }}
                            className="justify-start"
                            data-test="crop-formato"
                        >
                            {formatos.map((opcion) => (
                                <ToggleGroupItem
                                    key={opcion.value}
                                    value={opcion.value}
                                    className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3"
                                >
                                    {opcion.label}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    ) : null}

                    <div className="bg-muted relative h-72 w-full overflow-hidden rounded-md">
                        {cropSrc ? (
                            <Cropper
                                image={cropSrc}
                                crop={crop}
                                zoom={zoom}
                                minZoom={elegido.aspecto === null ? 1 : 0.5}
                                aspect={aspecto}
                                restrictPosition={elegido.aspecto === null}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onMediaLoaded={(media) =>
                                    setAspectoImagen(
                                        media.naturalWidth /
                                            media.naturalHeight,
                                    )
                                }
                                onCropComplete={(_, pixels) =>
                                    setCroppedAreaPixels(pixels)
                                }
                            />
                        ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm">
                            Zoom
                        </span>
                        <input
                            type="range"
                            min={elegido.aspecto === null ? 1 : 0.5}
                            max={3}
                            step={0.05}
                            value={zoom}
                            onChange={(event) =>
                                setZoom(Number(event.target.value))
                            }
                            className="accent-primary flex-1"
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="secondary" onClick={closeCropDialog}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            data-test="crop-apply-button"
                            onClick={applyCrop}
                        >
                            Aplicar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
