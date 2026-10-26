{{--
    The product catalog, laid out for print (A4) with the company's colors:
    its sections in order (GeneradorCatalogo::secciones): cover, categorías
    whose productos fill their rows, texts and page breaks. Chromium turns it into
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
            .portada { height: auto !important; min-height: 200mm; }
        }

        /* Cover: a panel of the brand's colors. */
        .portada {
            height: 244mm;
            break-after: page;
            border-radius: 5mm;
            overflow: hidden;
            position: relative;
            color: var(--sobre-primario);
            background: linear-gradient(140deg, var(--primario) 0%, var(--primario) 45%, var(--acento) 100%);
            padding: 22mm 16mm 16mm;
            display: flex;
            flex-direction: column;
        }
        .portada__circulo {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
        }
        .portada__etiqueta {
            align-self: flex-start;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 3px;
            text-transform: uppercase;
            padding: 1.5mm 4mm;
            border-radius: 99px;
            background: rgba(255, 255, 255, 0.16);
        }
        .portada__titulo {
            margin-top: 12mm;
            font-size: 44px;
            font-weight: 900;
            line-height: 1.02;
            letter-spacing: -0.8px;
            text-transform: uppercase;
            max-width: 150mm;
        }
        .portada__eslogan {
            margin-top: 6mm;
            font-size: 15px;
            font-weight: 600;
            opacity: 0.92;
            max-width: 140mm;
        }
        .portada__descripcion {
            margin-top: 3mm;
            font-size: 10.5px;
            line-height: 1.5;
            opacity: 0.8;
            max-width: 130mm;
        }
        .portada__categorias {
            margin-top: auto;
            display: flex;
            flex-wrap: wrap;
            gap: 2mm;
        }
        .portada__categorias span {
            font-size: 9px;
            font-weight: 600;
            padding: 1.2mm 3.5mm;
            border-radius: 99px;
            border: 1px solid rgba(255, 255, 255, 0.35);
        }
        .portada__cifras {
            margin-top: 8mm;
            padding-top: 5mm;
            border-top: 1px solid rgba(255, 255, 255, 0.3);
            display: flex;
            gap: 12mm;
            font-size: 9px;
            opacity: 0.9;
        }
        .portada__cifras strong { display: block; font-size: 22px; font-weight: 900; }

        /* Sections */
        .categoria { margin-bottom: 7mm; }
        .categoria__titulo {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 4mm;
            margin-bottom: 4mm;
            break-after: avoid;
        }
        .categoria__titulo h2 {
            font-size: 17px;
            font-weight: 900;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--primario);
            line-height: 1.1;
        }
        .categoria__titulo h2::after {
            content: "";
            display: block;
            margin-top: 1.6mm;
            width: 28mm;
            height: 1.1mm;
            border-radius: 1mm;
            background: linear-gradient(90deg, var(--primario), var(--acento));
        }
        .categoria__conteo {
            flex-shrink: 0;
            font-size: 8.5px;
            font-weight: 700;
            color: var(--primario);
            background: var(--tinte);
            border: 1px solid var(--borde);
            padding: 0.8mm 3mm;
            border-radius: 99px;
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

        /* A subcategoría inside its categoría: a label over its own cards. */
        .subcategoria {
            display: flex;
            align-items: center;
            gap: 2mm;
            margin: 4.5mm 0 2.5mm;
            break-after: avoid;
        }
        .categoria__titulo + .subcategoria { margin-top: 0; }
        .subcategoria::before {
            content: "";
            width: 1.6mm;
            height: 1.6mm;
            border-radius: 50%;
            background: var(--acento);
            flex-shrink: 0;
        }
        .subcategoria h3 {
            font-size: 10.5px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: color-mix(in srgb, var(--primario) 80%, var(--acento));
        }
        .subcategoria span {
            font-size: 8px;
            font-weight: 700;
            color: var(--suave);
        }
        .subcategoria::after {
            content: "";
            flex: 1;
            height: 1px;
            background: var(--borde);
        }

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

        @forelse ($secciones as $seccion)
            @switch($seccion['tipo'])
                @case('portada')
                    <section class="portada">
                        <div class="portada__circulo" style="width: 120mm; height: 120mm; right: -40mm; top: -30mm;"></div>
                        <div class="portada__circulo" style="width: 70mm; height: 70mm; right: 30mm; bottom: 40mm;"></div>

                        <span class="portada__etiqueta">{{ $fecha }}</span>
                        <h1 class="portada__titulo">{{ $seccion['titulo'] }}</h1>
                        @if ($seccion['subtitulo'] || $empresa?->eslogan_empresa || $empresa)
                            <p class="portada__eslogan">{{ $seccion['subtitulo'] ?? ($empresa?->eslogan_empresa ?: $empresa?->nombre_empresa) }}</p>
                        @endif
                        @if ($empresa?->descripcion_empresa)
                            <p class="portada__descripcion">{{ $empresa->descripcion_empresa }}</p>
                        @endif

                        @if ($seccion['cifras'])
                            <div class="portada__categorias">
                                @foreach ($seccion['categorias'] as $nombre)
                                    <span>{{ $nombre }}</span>
                                @endforeach
                            </div>
                        @endif

                        <div class="portada__cifras">
                            @if ($seccion['cifras'])
                                <div><strong>{{ $seccion['total'] }}</strong>productos</div>
                                <div><strong>{{ count($seccion['categorias']) }}</strong>{{ count($seccion['categorias']) === 1 ? 'categoría' : 'categorías' }}</div>
                            @endif
                            @if ($empresa?->telefono_empresa || $empresa?->direccion_empresa)
                                <div style="margin-left: auto; text-align: right; line-height: 1.6;">
                                    @if ($empresa->telefono_empresa)
                                        <div>Tel. <b>{{ $empresa->telefono_empresa }}</b></div>
                                    @endif
                                    @if ($empresa->direccion_empresa)
                                        <div>{{ $empresa->direccion_empresa }}</div>
                                    @endif
                                </div>
                            @endif
                        </div>
                    </section>
                    @break

                @case('categoria')
                    @php
                        $productos = $seccion['productos'];
                    @endphp
                    <section class="categoria">
                        <div class="categoria__titulo">
                            <h2>{{ $seccion['titulo'] }}</h2>
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
                            <div class="subcategoria">
                                <h3>{{ $grupo['titulo'] }}</h3>
                                <span>{{ $productos->count() }}</span>
                            </div>
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
