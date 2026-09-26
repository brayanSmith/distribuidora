import type { PropsWithChildren, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = PropsWithChildren<{
    /** The table's scrolling container (the one with the horizontal scroll). */
    scrollRef: RefObject<HTMLDivElement | null>;
    className?: string;
}>;

/**
 * The bar under a table (row count, pager…). It sticks to the bottom of the
 * screen while the table is in view, so the pager is always at hand however
 * tall the page above is, and it carries a copy of the table's horizontal
 * scrollbar (kept in sync) so nobody has to scroll down to the table's end
 * to move it sideways.
 */
export default function TableBottomBar({
    scrollRef,
    className,
    children,
}: Props) {
    const proxyRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [widths, setWidths] = useState({ scroll: 0, client: 0 });
    // Whether the table's own horizontal scrollbar is on screen (its bottom
    // edge is in view and not under this bar): then the copy is not needed.
    const [nativeVisible, setNativeVisible] = useState(true);

    useEffect(() => {
        const target = scrollRef.current;

        if (!target) {
            return;
        }

        const measure = () =>
            setWidths((current) =>
                current.scroll === target.scrollWidth &&
                current.client === target.clientWidth
                    ? current
                    : {
                          scroll: target.scrollWidth,
                          client: target.clientWidth,
                      },
            );

        const followTarget = () => {
            if (proxyRef.current) {
                proxyRef.current.scrollLeft = target.scrollLeft;
            }
        };

        measure();

        // The table grows or shrinks when its columns are resized or hidden.
        const observer = new ResizeObserver(measure);
        observer.observe(target);

        if (target.firstElementChild) {
            observer.observe(target.firstElementChild);
        }

        target.addEventListener('scroll', followTarget, { passive: true });

        return () => {
            observer.disconnect();
            target.removeEventListener('scroll', followTarget);
        };
    }, [scrollRef]);

    useEffect(() => {
        const target = scrollRef.current;

        if (!target) {
            return;
        }

        let frame = 0;

        const update = () => {
            frame = 0;

            // This bar without the copy: its content plus the padding and border.
            const barHeight = (contentRef.current?.offsetHeight ?? 0) + 13;
            const bottom = target.getBoundingClientRect().bottom;

            setNativeVisible(
                bottom > 0 && bottom <= window.innerHeight - barHeight + 1,
            );
        };

        const schedule = () => {
            if (!frame) {
                frame = requestAnimationFrame(update);
            }
        };

        update();
        // Capture: the page may scroll inside a container, not the window.
        window.addEventListener('scroll', schedule, {
            capture: true,
            passive: true,
        });
        window.addEventListener('resize', schedule);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule, { capture: true });
            window.removeEventListener('resize', schedule);
        };
    }, [scrollRef]);

    const overflowing = widths.scroll > widths.client + 1;

    return (
        <div
            className="bg-background sticky bottom-0 z-30 border-t pt-1 pb-2"
            data-test="table-bottom-bar"
        >
            {overflowing && !nativeVisible ? (
                <div
                    ref={(element) => {
                        proxyRef.current = element;

                        if (element && scrollRef.current) {
                            element.scrollLeft = scrollRef.current.scrollLeft;
                        }
                    }}
                    onScroll={(event) => {
                        if (scrollRef.current) {
                            scrollRef.current.scrollLeft =
                                event.currentTarget.scrollLeft;
                        }
                    }}
                    className="mb-1 overflow-x-auto overflow-y-hidden"
                    aria-hidden
                >
                    <div style={{ width: widths.scroll, height: 1 }} />
                </div>
            ) : null}

            <div ref={contentRef} className={cn(className)}>
                {children}
            </div>
        </div>
    );
}
