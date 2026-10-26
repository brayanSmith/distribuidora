{{--
    The catalog's page footer: the company's networks (with their icons, the
    ones the design shows), a text (its own, or who the company works with)
    and the page number. Repeated by Chromium on every page of
    the PDF; the browser preview shows it once, at the bottom (without page
    numbers).
--}}
@use('App\Support\RedesSociales')
@php
    // The browser preview has no pages to number.
    $paginas = ($paginas ?? true) && $piePagina['paginas'];
    // Without networks at all, its phone and email.
    $contactos = $redes !== [] || ($empresa?->redes ?? []) !== [] ? $redes : array_values(array_filter([
        $empresa?->telefono_empresa ? ['red' => 'telefono', 'valor' => $empresa->telefono_empresa, 'imagen' => null] : null,
        $empresa?->email_empresa ? ['red' => 'correo', 'valor' => $empresa->email_empresa, 'imagen' => null] : null,
    ]));
@endphp
<div style="width: 100%; padding: 0 10mm 5mm; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 8px; color: #475569; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
    <div style="height: 0.6mm; margin-bottom: 2.5mm; background: linear-gradient(90deg, {{ $paleta['acento'] }}, {{ $paleta['primario'] }});"></div>

    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6mm;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 1.2mm 4.5mm; min-width: 0;">
            @foreach ($contactos as $contacto)
                <span style="display: inline-flex; align-items: center; gap: 1.2mm;">
                    @if ($contacto['imagen'])
                        <img src="{{ $contacto['imagen'] }}" alt="" style="width: 11px; height: 11px; object-fit: contain;">
                    @else
                        {!! RedesSociales::svg($contacto['red'], $paleta['acento'], '11px') !!}
                    @endif
                    <strong style="color: #0f172a;">{{ $contacto['valor'] }}</strong>
                </span>
            @endforeach
        </div>

        @if ($piePagina['texto'])
            <div style="text-align: center; flex-shrink: 0; max-width: 70mm;">{{ $piePagina['texto'] }}</div>
        @elseif ($piePagina['colaboracion'])
            <div style="text-align: center; flex-shrink: 0;">
                En colaboración de <strong style="color: {{ $paleta['primario'] }};">{{ $piePagina['colaboracion'] }}</strong>
            </div>
        @endif

        @if ($paginas)
            <span style="flex-shrink: 0; padding: 0.6mm 2.4mm; border-radius: 99px; font-weight: 700; background: {{ $paleta['primario'] }}; color: {{ $paleta['sobre_primario'] }};">
                <span class="pageNumber"></span> / <span class="totalPages"></span>
            </span>
        @else
            <span style="flex-shrink: 0; color: #94a3b8;">{{ $empresa?->nombre_empresa }}</span>
        @endif
    </div>
</div>
