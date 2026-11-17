# Black Friday Acerbis · Reynasa Moto 2026

Webapp B2B (React + TypeScript + Vite) para talleres y tiendas, con el catálogo completo del Excel de campaña:
**438 referencias → 161 productos (modelos) en 15 familias, 809 unidades.**

## Ejecutar

```bash
npm install          # solo la primera vez
npm run dev          # desarrollo en http://localhost:5173
npm run build        # genera dist/ (sitio estático, rutas relativas)
npm run preview      # sirve dist/ para la vista previa final
npm test             # 23 pruebas (dinero, cierre, pedido, búsqueda, filtros, agrupación)
npm run verificar    # relee el Excel y comprueba el catálogo generado
```

`dist/` es un sitio estático: súbelo a cualquier alojamiento web (no se abre bien con doble clic, necesita servidor; `npm run preview` lo resuelve en local).

La pantalla interna de revisión está en `#/revision` (enlace «Revisión interna de datos» en el pie). No es para clientes.

## Actualizar el Excel (precios y existencias)

1. Copia el nuevo `.xlsx` a `data/source/` (sustituyendo al anterior). Debe tener la hoja `Hoja1` y las mismas 7 columnas (Artículo, Descripcion Articulo, Unidades en Oferta, pvp, Neto Oferta, Dto en oferta, Enlace a imagen).
2. `npm run importar -- --imagenes` (la opción `--imagenes` comprueba con una petición HEAD que cada foto carga; sin ella usa la última comprobación).
3. `npm run verificar` y `npm test`.
4. `npm run build` y publica `dist/`.

Qué se genera:

| Archivo | Contenido |
|---|---|
| `src/data/catalog.json` | Catálogo normalizado que usa la web (incluye fecha de importación y SHA-256 del Excel) |
| `src/data/review.json` | Registro de revisión: herencias de descripción, agrupaciones, pendientes, imágenes caídas |
| `data/output/catalogo-normalizado.csv` | Una línea por variante (abre en Excel), con fila de origen, descripción original/usada y avisos |
| `data/output/filas-origen.json` | Las filas originales del Excel con su número de fila |

Si el nuevo Excel trae productos nuevos, revisa `#/revision`: los modelos nuevos se clasifican por palabras clave. Para corregir nombre o familia de un modelo concreto, añade una entrada en `data/overrides/models.json` (`{ "0012345": { "name": "…", "familyId": "cascos", "subfamilyId": "jet" } }`) y vuelve a importar. Si cambia el Excel, el pedido guardado en el navegador de cada cliente se descarta automáticamente.

## Cómo se agrupa

- **Referencia** (`0025593 319 061 ACB`) = modelo (7 cifras) + color (3) + sufijo opcional (3) + `ACB`. Siempre texto.
- **Producto** = modelo (7 cifras). Dentro, cada código de color es un grupo (`0025593.319`); cada referencia es una variante vendible con su talla, color, stock y precio. Los grupos de color se ven en la tabla de la ficha.
- **Descripción «0»**: solo se hereda de otra fila del *mismo modelo y mismo código de color*; si no existe, se señala (caso `0026149290070ACB`, color 290, que no hereda el color de otros bloques).
- **Tallas**: tabla Acerbis 061 XS · 062 S · 063 S/M · 064 M · 066 L · 067 L/XL · 068 XL · 069 XXL · 070 XXXL. Los sufijos numéricos (030, 032, 033, 043, 050, 052, 054) y los que no son talla (003, 016, 023, 098) se conservan pero no se convierten en talla sin validación.
- **Colores**: la etiqueta sale de las descripciones del mismo modelo y código; si dos códigos tienen la misma etiqueta (p. ej. «Negro» 090 y 319) se distinguen con el código.
- **Precios**: se redondea una sola vez, half-up, el neto unitario de la columna E a céntimos; los totales usan ese precio mostrado × unidades. El descuento mostrado sale de la columna F (el 29,64 % de las botas X-Rock se conserva).

## Configuración de campaña

Todo en `src/config/campaign.ts`: pedido mínimo, fecha de cierre (30/11/2026, zona `Europe/Madrid`; el último día sigue activo hasta las 00:00 de Madrid), mensajes de condiciones, IVA (confirmado: **no incluido**, aparece como condición), logotipo de Reynasa y canal de pedidos (ninguno: la web no está conectada con nada).
En desarrollo se puede simular la fecha con `?ahora=2026-12-01T10:00:00`.

## Imágenes

Las fotos salen de la columna G del Excel. Si una URL da 404, la importación (`npm run importar -- --imagenes`) usa la foto de la **referencia padre** (modelo + color, sin talla; p. ej. `0022649.090.jpg` para `0022649090068ACB`); si el padre tampoco existe, la de otra variante verificada del mismo color; y si no hay ninguna, un marcador discreto. Nunca se sustituye por otro artículo. El resultado queda en `#/revision` y en la columna «Avisos» del CSV normalizado.

## Puntos pendientes

1. **Logotipo de Reynasa**: resuelto. Se usan los PDF `Logo_Negativo_Pantone.pdf` y `Logo_Positivo_Pantone.pdf`, convertidos a SVG vectorial sin tocar el diseño (`public/brand/reynasa-negativo.svg`, sin el fondo oscuro; `reynasa-positivo.svg` para superficies claras). Es el **único logo de la cabecera** («Moto» va en texto junto a él); el logo de Acerbis ya no aparece ahí. Ojo: el logo oficial trae la leyenda «RECAMBIOS» debajo de «REYNASA»; se muestra tal cual.
2. ~~Logotipo Acerbis pequeño~~ Resuelto: se usa `Acerbis_logo.png` (3000×1000, transparente), recortado y colocado como protagonista del **titular del hero** («Black Friday [logo Acerbis]», sobre chapa amarilla); el original está en `data/source/Acerbis_logo-original.png`.
3. **419 vs 438 referencias**: el encargo habla de 419; el Excel trae 438 únicas (809 uds.). Se trabaja con las 438.
4. **Descripción «0» sin resolver**: `0026149290070ACB` (color 290).
5. **Imágenes**: 59 URLs del Excel dan 404. 52 usan la foto de la referencia padre, 4 la de otra variante del mismo color (`0025424030068`, `0026150723066`, `0026150723069`, `0026918090067`) y 3 se quedan con marcador porque no existe ninguna foto (`0025424070066`, `0025424070068`, `0026653120`). Además cada foto pesa ~3 MB; conviene servir miniaturas.
6. **Tallas/versiones sin validar**: sufijos 030/032/033 (vaqueros), 043 (botas X-Rock), 050/052 (casco junior Carlino) y versiones 003/016/023/098.
7. **Familias dudosas**: cascos Linear, Profile 5 y Reactive («Otros cascos»), protector de palma 0022717, «Protector puños» 0025423, kit de montaje 0024845, membrana 0022649.
8. **Colores sin confirmar** en códigos sin descripción de color y descripciones contradictorias (p. ej. 0026149.318: «gris y amarillo» vs «negro y amarillo»).
9. **Existencias**: el Excel es una fotografía, no hay stock en tiempo real. La condición visible dice solo «Existencias sujetas a confirmación.» (a petición de Reynasa, sin la fecha); la fecha de importación completa solo se ve en `#/revision`.
10. Las condiciones mostradas son solo las facilitadas: pedido mínimo, portes a Península, validez e IVA no incluido. No se han añadido plazos, formas de pago ni otras.
