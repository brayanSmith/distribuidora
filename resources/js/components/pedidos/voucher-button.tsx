import { useHttp } from '@inertiajs/react';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import VoucherPreviewModal from '@/components/pedidos/voucher-preview-modal';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PosVoucher } from '@/types';

type Props = {
    /** The Wayfinder route definition that returns the pedido's voucher data. */
    action: { url: string; method: string };
    /** Show a text label next to the icon (the modal) or the icon alone (tables). */
    label?: string;
    dataTest?: string;
};

/**
 * Shows a pedido's payment voucher as a PDF preview, from where it is
 * printed or downloaded: fetches its data and renders the PDF in the browser.
 */
export default function VoucherButton({
    action,
    label,
    dataTest = 'voucher-button',
}: Props) {
    const { submit } = useHttp();
    const [abierto, setAbierto] = useState(false);
    const [voucher, setVoucher] = useState<PosVoucher | null>(null);

    const ver = async () => {
        setVoucher(null);
        setAbierto(true);

        try {
            setVoucher((await submit('get', action.url)) as PosVoucher);
        } catch {
            setAbierto(false);
            toast.error('No se pudo cargar el voucher.');
        }
    };

    const button = (
        <Button
            type="button"
            variant={label ? 'outline' : 'ghost'}
            size="sm"
            onClick={ver}
            data-test={dataTest}
        >
            <FileText className="h-4 w-4" />
            {label ?? null}
        </Button>
    );

    return (
        <>
            {label ? (
                button
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent>
                        <p>Ver voucher</p>
                    </TooltipContent>
                </Tooltip>
            )}

            {abierto ? (
                <VoucherPreviewModal
                    voucher={voucher}
                    onClose={() => setAbierto(false)}
                />
            ) : null}
        </>
    );
}
