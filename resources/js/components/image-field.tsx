import { useRef, useState } from 'react';
import ImageDropCropper from '@/components/image-drop-cropper';
import type { FormatoRecorte } from '@/components/image-drop-cropper';

type Props = {
    /** Form field name of the uploaded file. */
    name: string;
    /** Form field name of the "remove the current image" flag. */
    removeName: string;
    label: string;
    value?: string | null;
    error?: string;
    /** The shapes it can be cropped to (square by default). */
    formatos?: FormatoRecorte[];
    formatoInicial?: string;
    onFormatoChange?: (formato: string, aspecto: number) => void;
    /** The longest side of the uploaded image, in px. */
    maxLado?: number;
};

/**
 * An image picker (drop, crop, preview) that takes part in a normal
 * `<Form>`: it renders the hidden file input and the remove flag so the
 * cropped file is submitted under `name` and a removal under `removeName`.
 */
export default function ImageField({
    name,
    removeName,
    label,
    value,
    error,
    formatos,
    formatoInicial,
    onFormatoChange,
    maxLado,
}: Props) {
    const [removed, setRemoved] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (file: File | null, wasRemoved: boolean) => {
        setRemoved(wasRemoved);

        if (!fileInputRef.current) {
            return;
        }

        const dataTransfer = new DataTransfer();

        if (file) {
            dataTransfer.items.add(file);
        }

        fileInputRef.current.files = dataTransfer.files;
    };

    return (
        <>
            <ImageDropCropper
                label={label}
                value={value}
                onChange={handleChange}
                error={error}
                formatos={formatos}
                formatoInicial={formatoInicial}
                onFormatoChange={onFormatoChange}
                maxLado={maxLado}
            />
            <input
                ref={fileInputRef}
                type="file"
                name={name}
                className="hidden"
            />
            <input
                type="hidden"
                name={removeName}
                value={removed ? '1' : '0'}
            />
        </>
    );
}
