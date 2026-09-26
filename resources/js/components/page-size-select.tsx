import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Props = {
    value: number;
    onChange: (pageSize: number) => void;
    /** Quick picks; "Otro" lets the user type any other amount. */
    options?: number[];
    /** Largest amount that can be typed. */
    max?: number;
    dataTest?: string;
};

const CUSTOM = 'custom';

/**
 * "Filas: [25 ▾]" — how many rows a table page shows. Offers the usual
 * amounts and an "Otro" option that opens a number field for any amount.
 */
export default function PageSizeSelect({
    value,
    onChange,
    options = [25, 50, 100],
    max = 500,
    dataTest = 'page-size',
}: Props) {
    const isPreset = options.includes(value);
    // "Otro" stays picked while its number is being typed.
    const [customOpen, setCustomOpen] = useState(!isPreset);
    const [draft, setDraft] = useState(String(value));
    const showCustom = customOpen || !isPreset;

    useEffect(() => {
        setDraft(String(value));
    }, [value]);

    const commit = () => {
        const amount = Math.floor(Number(draft));

        if (Number.isFinite(amount) && amount >= 1) {
            onChange(Math.min(amount, max));
        } else {
            setDraft(String(value));
        }
    };

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">
                Filas
            </span>
            <Select
                value={showCustom ? CUSTOM : String(value)}
                onValueChange={(next) => {
                    if (next === CUSTOM) {
                        setCustomOpen(true);

                        return;
                    }

                    setCustomOpen(false);
                    onChange(Number(next));
                }}
            >
                <SelectTrigger
                    size="sm"
                    className="h-8 w-24 text-xs"
                    data-test={dataTest}
                >
                    <SelectValue />
                </SelectTrigger>
                {/* It sits under the table, so the list opens upwards. */}
                <SelectContent side="top">
                    {options.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                            {option}
                        </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM}>Otro…</SelectItem>
                </SelectContent>
            </Select>

            {showCustom ? (
                <Input
                    type="number"
                    min={1}
                    max={max}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commit}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.currentTarget.blur();
                        }
                    }}
                    onFocus={(event) => event.target.select()}
                    className="h-8 w-20 text-xs"
                    title={`De 1 a ${max} filas`}
                    data-test={`${dataTest}-custom`}
                />
            ) : null}
        </div>
    );
}
