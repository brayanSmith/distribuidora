import { Download, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { PosVoucher } from '@/types';

type Props = {
    /** The voucher data; null while it is still being fetched. */
    voucher: PosVoucher | null;
    onClose: () => void;
};

/**
 * Shows a pedido's voucher PDF before doing anything with it, with buttons
 * to print or download it. The PDF renderer loads only on first use.
 */
export default function VoucherPreviewModal({ voucher, onClose }: Props) {
    const [url, setUrl] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!voucher) {
            return;
        }

        let cancelado = false;
        let creada: string | null = null;

        (async () => {
            try {
                const { generarVoucherPdf } =
                    await import('@/components/pos/voucher-pdf');
                const blob = await generarVoucherPdf(voucher);

                if (!cancelado) {
                    creada = URL.createObjectURL(blob);
                    setUrl(creada);
                }
            } catch {
                toast.error('No se pudo generar el voucher.');
                onClose();
            }
        })();

        return () => {
            cancelado = true;

            if (creada) {
                URL.revokeObjectURL(creada);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [voucher]);

    const nombre = voucher
        ? `Voucher-${voucher.pedido.turno ?? voucher.pedido.id}.pdf`
        : 'Voucher.pdf';

    const imprimir = () => {
        try {
            iframeRef.current?.contentWindow?.focus();
            iframeRef.current?.contentWindow?.print();
        } catch {
            // Some browsers don't let the page print an embedded PDF.
            window.open(url ?? '', '_blank');
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="flex max-h-[95svh] flex-col sm:max-w-md"
                data-test="voucher-preview"
            >
                <DialogHeader>
                    <DialogTitle>
                        Voucher
                        {voucher ? ` · Remisión N° ${voucher.pedido.id}` : ''}
                    </DialogTitle>
                    <DialogDescription>
                        Revísalo y luego imprímelo o descárgalo.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-muted flex min-h-[60svh] flex-1 items-center justify-center overflow-hidden rounded-md border">
                    {url ? (
                        <iframe
                            ref={iframeRef}
                            src={url}
                            title={nombre}
                            className="h-[60svh] w-full bg-white"
                            data-test="voucher-preview-pdf"
                        />
                    ) : (
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Spinner />
                            Generando voucher...
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            Cerrar
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!url}
                        asChild={!!url}
                    >
                        {url ? (
                            <a href={url} download={nombre}>
                                <Download />
                                Descargar
                            </a>
                        ) : (
                            <>
                                <Download />
                                Descargar
                            </>
                        )}
                    </Button>
                    <Button
                        type="button"
                        disabled={!url}
                        onClick={imprimir}
                        data-test="voucher-preview-imprimir"
                    >
                        <Printer />
                        Imprimir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
