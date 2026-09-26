import type { PointerEvent as ReactPointerEvent } from 'react';

type Props = {
    onPointerDown: (event: ReactPointerEvent) => void;
};

/**
 * The strip on a table header's right edge that resizes the column when
 * dragged. It listens to pointer events, so it works with a mouse and with a
 * finger; on touch screens it is wider and always visible (there is no hover
 * to reveal it) and stops the browser from scrolling while it is dragged.
 */
export default function ColumnResizeHandle({ onPointerDown }: Props) {
    return (
        <span
            onPointerDown={onPointerDown}
            className="group absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize touch-none justify-end select-none pointer-coarse:w-5"
        >
            <span className="group-hover:bg-primary/50 group-active:bg-primary pointer-coarse:bg-border h-full w-0.5 pointer-coarse:w-1" />
        </span>
    );
}
