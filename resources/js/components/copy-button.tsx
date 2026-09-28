import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { cn } from '@/lib/utils';

type Props = {
    value: string | null | undefined;
    label: string;
    className?: string;
};

/** Small icon button that copies `value` to the clipboard, next to a field. */
export default function CopyButton({ value, label, className }: Props) {
    const [, copy] = useClipboard();
    const [copiado, setCopiado] = useState(false);

    if (!value) {
        return null;
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('size-6', className)}
            title={`Copiar ${label}`}
            aria-label={`Copiar ${label}`}
            data-test="copy-button"
            onClick={async () => {
                if (await copy(value)) {
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1500);
                }
            }}
        >
            {copiado ? (
                <Check className="size-3.5 text-emerald-600" />
            ) : (
                <Copy className="text-muted-foreground size-3.5" />
            )}
        </Button>
    );
}
