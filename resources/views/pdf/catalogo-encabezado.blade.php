{{--
    The catalog's page header: the logo and a title with its subtitle (the
    design's own, or the company's slogan and description), over a band of
    its colors. Chromium repeats it on every page of the PDF (drawn apart from
    the page, so styles are inline and the logo embedded); the browser
    preview shows it once, on top.
--}}
<div style="width: 100%; padding: 6mm 10mm 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
    <div style="display: flex; align-items: center; justify-content: {{ $cabecera['logo'] ? 'space-between' : 'flex-end' }}; gap: 8mm;">
        @if ($cabecera['logo'])
            <div style="flex-shrink: 0; display: flex; align-items: center;">
                <img src="{{ $cabecera['logo'] }}" alt="" style="max-height: 15mm; max-width: 55mm; object-fit: contain;">
            </div>
        @endif

        <div style="text-align: {{ $cabecera['logo'] ? 'right' : 'left' }}; min-width: 0; flex: 1;">
            <div style="font-size: 14px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: {{ $paleta['primario'] }}; line-height: 1.15;">
                {{ $cabecera['titulo'] }}
            </div>
            @if ($cabecera['subtitulo'])
                <div style="margin-top: 1mm; font-size: 8px; line-height: 1.35; color: #64748b; max-width: 120mm; {{ $cabecera['logo'] ? 'margin-left: auto;' : '' }}">
                    {{ $cabecera['subtitulo'] }}
                </div>
            @endif
        </div>
    </div>

    <div style="margin-top: 3mm; height: 1.2mm; border-radius: 1mm; background: linear-gradient(90deg, {{ $paleta['primario'] }}, {{ $paleta['acento'] }});"></div>
</div>
