{{--
    The product catalog, laid out for print (A4) with the company's colors:
    an opening band (title, figures, index), then its sections in order
    (GeneradorCatalogo::secciones): numbered categorías whose productos fill
    their rows, texts and page breaks. Chromium turns it into
    the PDF and adds the header and footer of every page; the browser
    preview ($web) shows them once, around the page.
--}}
@php
    $precio = fn (float $valor): string => '$'.number_format($valor, 0, ',', '.');
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>{{ $opciones['titulo'] }}</title>
    <style>
        :root {
            --primario: {{ $paleta['primario'] }};
            --acento: {{ $paleta['acento'] }};
            --sobre-primario: {{ $paleta['sobre_primario'] }};
            --sobre-acento: {{ $paleta['sobre_acento'] }};
            --tinte: color-mix(in srgb, var(--primario) 6%, #fff);
            --borde: color-mix(in srgb, var(--primario) 14%, #fff);
            --tinta: #0f172a;
            --suave: #64748b;
            --separacion: 3.5mm;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            color: var(--tinta);
            font-size: 10px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .hoja { padding: 0 10mm; }

        @media screen {
            body { background: #e2e8f0; padding: 8mm 0; }
            .hoja {
                max-width: 210mm;
                margin: 0 auto;
                background: #fff;
                padding: 0 10mm 4mm;
                box-shadow: 0 2mm 8mm rgba(15, 23, 42, 0.15);
            }
            .hoja__encabezado { margin: 0 -10mm 6mm; }
            .hoja__pie { margin: 6mm -10mm 0; }
        }

        /* The band that opens the catalog: title, figures and the index. */
        .presentacion {
            position: relative;
            overflow: hidden;
            border-radius: 4mm;
            padding: 7mm 8mm 6mm;
            margin-bottom: 8mm;
            color: var(--sobre-primario);
            background: linear-gradient(120deg, var(--primario) 0%, var(--primario) 40%, var(--acento) 100%);
            break-inside: avoid;
        }
        .presentacion__circulo {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
        }
        /* The logo leads the band, on a white tile so any logo reads on the gradient. */
        .presentacion__logo {
            flex-shrink: 0;
            width: 30mm;
            height: 30mm;
            padding: 2.5mm;
            border-radius: 4mm;
            background: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1mm 3mm rgba(15, 23, 42, 0.25);
        }
        .presentacion__logo img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        .presentacion__textos { flex: 1; min-width: 0; }
        .presentacion__fila {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6mm;
        }
        .presentacion__etiqueta {
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            opacity: 0.85;
        }
        .presentacion h1 {
            margin-top: 1.5mm;
            font-size: 26px;
            font-weight: 900;
            line-height: 1.05;
            letter-spacing: -0.3px;
            text-transform: uppercase;
        }
        .presentacion__precio {
            display: inline-block;
            margin-top: 2.5mm;
            font-size: 8.5px;
            font-weight: 700;
            padding: 0.8mm 3mm;
            border-radius: 99px;
            background: rgba(255, 255, 255, 0.18);
        }
        .presentacion__cifras { display: flex; gap: 3mm; flex-shrink: 0; }
        .presentacion__cifra {
            min-width: 22mm;
            text-align: center;
            padding: 2.5mm 4mm;
            border-radius: 3mm;
            background: rgba(255, 255, 255, 0.14);
            border: 1px solid rgba(255, 255, 255, 0.25);
        }
        .presentacion__cifra strong { display: block; font-size: 20px; font-weight: 900; line-height: 1; }
        .presentacion__cifra span {
            font-size: 7px;
            letter-spacing: 1px;
            text-transform: uppercase;
            opacity: 0.85;
        }
        .presentacion__indice {
            position: relative;
            margin-top: 5mm;
            padding-top: 4mm;
            border-top: 1px solid rgba(255, 255, 255, 0.25);
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(52mm, 1fr));
            gap: 1.6mm 6mm;
            font-size: 8.5px;
        }
        .presentacion__indice div { display: flex; align-items: baseline; gap: 1.5mm; min-width: 0; }
        .presentacion__indice b { font-size: 7.5px; opacity: 0.7; }
        .presentacion__indice span { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .presentacion__indice i {
            flex: 1;
            min-width: 3mm;
            border-bottom: 1px dotted rgba(255, 255, 255, 0.4);
        }
        .presentacion__indice em { font-style: normal; opacity: 0.85; }

        /* Sections: each categoría opens with a quiet title over a thin rule. */
        .categoria { margin-bottom: 10mm; }
        .categoria__titulo {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 4mm;
            padding-bottom: 2mm;
            margin-bottom: 4mm;
            border-bottom: 0.4mm solid var(--primario);
            break-after: avoid;
        }
        .categoria__seccion {
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--acento);
        }
        .categoria__titulo h2 {
            margin-top: 0.8mm;
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: var(--primario);
            line-height: 1.05;
        }
        .categoria__conteo {
            flex-shrink: 0;
            font-size: 8.5px;
            color: var(--suave);
        }

        /* The cards of a categoría fill their rows; the last one is centered. */
        .grilla {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: var(--separacion);
        }
        .grilla > .tarjeta {
            width: calc((100% - (var(--columnas) - 1) * var(--separacion)) / var(--columnas));
        }

        .tarjeta {
            background: #fff;
            border: 1px solid var(--borde);
            border-radius: 3mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            break-inside: avoid;
            box-shadow: 0 0.5mm 1.8mm rgba(15, 23, 42, 0.07);
        }
        /* Chromium prints shadows too dark: a firmer bottom edge instead. */
        @media print {
            .tarjeta { box-shadow: none; border-bottom-width: 0.6mm; }
        }
        .tarjeta__imagen {
            height: var(--alto-imagen);
            background: radial-gradient(circle at 50% 40%, #fff 0%, var(--tinte) 75%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2.5mm;
            flex-shrink: 0;
        }
        .tarjeta__imagen img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        .tarjeta__sin-imagen {
            width: 35%;
            max-width: 14mm;
            color: color-mix(in srgb, var(--primario) 22%, #fff);
        }
        .tarjeta__cuerpo {
            padding: 2mm 2.5mm 2.5mm;
            display: flex;
            flex-direction: column;
            gap: 0.8mm;
            flex: 1;
        }
        .tarjeta__nombre {
            font-size: var(--letra-nombre);
            font-weight: 700;
            line-height: 1.25;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .tarjeta__descripcion {
            font-size: 8.5px;
            color: var(--suave);
            line-height: 1.35;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .tarjeta__pie {
            margin-top: auto;
            padding-top: 1.2mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1.5mm;
        }
        .tarjeta__sku {
            font-size: 6.5px;
            color: var(--suave);
            font-family: "SFMono-Regular", Consolas, monospace;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .tarjeta__precio {
            flex-shrink: 0;
            margin-left: auto;
            font-size: var(--letra-precio);
            font-weight: 800;
            white-space: nowrap;
            padding: 0.6mm 2.2mm;
            border-radius: 99px;
            background: var(--acento);
            color: var(--sobre-acento);
        }

        /* One or two productos: wide, the image beside the text. */
        .tarjeta--horizontal { flex-direction: row; }
        .tarjeta--horizontal .tarjeta__imagen {
            width: var(--alto-imagen);
            border-right: 1px solid var(--borde);
        }
        .tarjeta--horizontal .tarjeta__cuerpo { padding: 4mm 4.5mm; gap: 1.5mm; justify-content: center; }
        .tarjeta--horizontal .tarjeta__pie { margin-top: 2mm; }

        /* A subcategoría inside its categoría: a small label over its cards. */
        .subcategoria {
            margin: 5mm 0 2mm;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: color-mix(in srgb, var(--primario) 75%, #fff);
            break-after: avoid;
        }
        .categoria__titulo + .subcategoria { margin-top: 0; }

        /* Free text */
        .texto {
            margin-bottom: 7mm;
            break-inside: avoid;
            font-size: 10px;
            line-height: 1.55;
            color: #334155;
        }
        .texto h3 {
            font-size: 13px;
            font-weight: 800;
            color: var(--primario);
            margin-bottom: 1.5mm;
        }
        .texto--destacado {
            background: var(--tinte);
            border: 1px solid var(--borde);
            border-left: 1.2mm solid var(--acento);
            border-radius: 3mm;
            padding: 4mm 5mm;
        }

        /* Page break: what follows starts on a new page. */
        .salto { break-after: page; }
        @media screen {
            .salto {
                border-top: 1px dashed var(--borde);
                margin: 6mm -10mm;
                position: relative;
            }
            .salto::after {
                content: "Salto de página";
                position: absolute;
                left: 50%;
                top: -2.2mm;
                transform: translateX(-50%);
                background: #fff;
                padding: 0 2mm;
                font-size: 8px;
                color: var(--suave);
            }
        }

        .vacio {
            text-align: center;
            color: var(--suave);
            padding: 40mm 0;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="hoja">
        @if ($web && $opciones['encabezado'])
            <div class="hoja__encabezado">
                @include('pdf.catalogo-encabezado')
            </div>
        @endif

        @if ($presentacion)
            <section class="presentacion">
                <div class="presentacion__circulo" style="width: 70mm; height: 70mm; right: -18mm; top: -30mm;"></div>
                <div class="presentacion__circulo" style="width: 34mm; height: 34mm; right: 48mm; bottom: -20mm;"></div>

                <div class="presentacion__fila">
                    @if ($logo)
                        <div class="presentacion__logo">
                            <img src="{{ $logo }}" alt="{{ $empresa?->nombre_empresa }}">
                        </div>
                    @endif
                    <div class="presentacion__textos">
                        <div class="presentacion__etiqueta">{{ $fecha }}</div>
                        <h1>{{ $presentacion['titulo'] }}</h1>
                        @if ($presentacion['precio'])
                            <span class="presentacion__precio">{{ $presentacion['precio'] }}</span>
                        @endif
                    </div>
                    <div class="presentacion__cifras">
                        <div class="presentacion__cifra"><strong>{{ $presentacion['total'] }}</strong><span>{{ $presentacion['total'] === 1 ? 'Producto' : 'Productos' }}</span></div>
                        <div class="presentacion__cifra"><strong>{{ count($presentacion['categorias']) }}</strong><span>{{ count($presentacion['categorias']) === 1 ? 'Categoría' : 'Categorías' }}</span></div>
                    </div>
                </div>

                <div class="presentacion__indice">
                    @foreach ($presentacion['categorias'] as $indice => $categoria)
                        <div>
                            <b>{{ str_pad((string) ($indice + 1), 2, '0', STR_PAD_LEFT) }}</b>
                            <span>{{ $categoria['titulo'] }}</span>
                            <i></i>
                            <em>{{ $categoria['total'] }}</em>
                        </div>
                    @endforeach
                </div>
            </section>
        @endif

        @forelse ($secciones as $seccion)
            @switch($seccion['tipo'])
                @case('categoria')
                    @php
                        $productos = $seccion['productos'];
                    @endphp
                    <section class="categoria">
                        <div class="categoria__titulo">
                            <div>
                                <div class="categoria__seccion">Sección <span class="categoria__numero">{{ str_pad((string) $seccion['numero'], 2, '0', STR_PAD_LEFT) }}</span></div>
                                <h2>{{ $seccion['titulo'] }}</h2>
                            </div>
                            <span class="categoria__conteo">{{ $productos->count() }} {{ $productos->count() === 1 ? 'producto' : 'productos' }}</span>
                        </div>

                        @foreach ($seccion['grupos'] as $grupo)
                        @php
                            $productos = $grupo['productos'];
                            $horizontal = $grupo['disposicion']['modo'] === 'horizontal';
                            $columnas = $grupo['disposicion']['columnas'];
                            [$altoImagen, $letraNombre, $letraPrecio] = match (true) {
                                // Inside a subcategoría the few productos lie as slim rows.
                                $horizontal && $grupo['titulo'] !== null => ['22mm', '10px', '10px'],
                                $horizontal && $columnas === 1 => ['38mm', '12.5px', '12px'],
                                $horizontal => ['30mm', '10.5px', '10.5px'],
                                $columnas <= 2 => ['40mm', '10.5px', '11px'],
                                $columnas === 3 => ['30mm', '9px', '9.5px'],
                                $columnas === 4 => ['24mm', '8px', '8.5px'],
                                default => ['19mm', '7.5px', '8px'],
                            };
                        @endphp
                        @if ($grupo['titulo'])
                            <h3 class="subcategoria">{{ $grupo['titulo'] }}</h3>
                        @endif

                        <div class="grilla" style="--columnas: {{ $columnas }}; --alto-imagen: {{ $altoImagen }}; --letra-nombre: {{ $letraNombre }}; --letra-precio: {{ $letraPrecio }};">
                            @foreach ($productos as $producto)
                                <article @class(['tarjeta', 'tarjeta--horizontal' => $horizontal])>
                                    <div class="tarjeta__imagen">
                                        @if ($producto['imagen'])
                                            <img src="{{ $producto['imagen'] }}" alt="">
                                        @else
                                            <svg class="tarjeta__sin-imagen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/></svg>
                                        @endif
                                    </div>
                                    <div class="tarjeta__cuerpo">
                                        <div class="tarjeta__nombre">{{ $producto['nombre'] }}</div>
                                        @if ($horizontal && $producto['descripcion'])
                                            <div class="tarjeta__descripcion">{{ $producto['descripcion'] }}</div>
                                        @endif
                                        <div class="tarjeta__pie">
                                            @if ($producto['sku'])
                                                <span class="tarjeta__sku">{{ $producto['sku'] }}</span>
                                            @endif
                                            @if ($producto['precio'] !== null)
                                                <span class="tarjeta__precio">{{ $precio($producto['precio']) }}</span>
                                            @endif
                                        </div>
                                    </div>
                                </article>
                            @endforeach
                        </div>
                        @endforeach
                    </section>
                    @break

                @case('texto')
                    <section @class(['texto', 'texto--destacado' => $seccion['destacado']]) style="text-align: {{ $seccion['alineacion'] }};">
                        @if ($seccion['titulo'])
                            <h3>{{ $seccion['titulo'] }}</h3>
                        @endif
                        @if ($seccion['texto'])
                            <p>{!! nl2br(e($seccion['texto'])) !!}</p>
                        @endif
                    </section>
                    @break

                @case('salto')
                    <div class="salto"></div>
                    @break
            @endswitch
        @empty
            <p class="vacio">No hay productos con estas opciones.</p>
        @endforelse

        @if ($web && $opciones['pie'])
            <div class="hoja__pie">
                @include('pdf.catalogo-pie', ['paginas' => false])
            </div>
        @endif
    </div>
</body>
</html>
