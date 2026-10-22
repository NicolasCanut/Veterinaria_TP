# Veterinaria Huellas

Trabajo cuatrimestral de Base de Datos Aplicada I / II. Panel SQL local para analizar consultas, mascotas, dueños y veterinarios. Todos los datos son ficticios.

## Ejecutar en Mac

Requiere **Node.js 24 o superior**. Verificar con `node --version`. Descomprimir el ZIP, abrir Terminal dentro de `Veterinaria_TP` y ejecutar:

```bash
npm start
```

Abrir **http://localhost:3000**. No requiere `npm install`, hosting ni conexión a internet. Detener con Control+C.

- Usuario: `docente@vet.local`
- Contraseña: `Veterinaria2026!`

La primera ejecución crea `data/veterinaria.sqlite`, ejecuta el esquema y los INSERT de ejemplo y agrega el usuario de acceso con contraseña protegida. Los siguientes inicios conservan la base. El servidor escucha solamente en la computadora local.

## Recorrido para la entrega

1. Entrar con el login: las credenciales se validan contra usuarios SQL.
2. Ver el panorama inicial: 180 consultas, 48 mascotas, 32 dueños, 75,2% de turnos atendidos y ARS 2.430.000 cobrados.
3. Elegir Laura Méndez: nivel 2, sus 45 consultas.
4. Abrir una consulta: nivel 3, mascota, dueño, veterinario y datos del turno.
5. Volver al veterinario y al panorama usando botones y breadcrumbs.
6. Cambiar mes o estado; buscar una mascota o un dueño. Los filtros se conservan al avanzar y volver. Limpiar restablece período, estado y búsqueda.
7. Comparar los semáforos: Laura verde, Martín amarillo, Camila rojo y Diego verde.
8. Abrir Mascotas y Dueños: cada vista agrupa registros SQL, sin confundir cantidad de consultas con personas o animales distintos.
9. Crear una consulta con + Nueva consulta. Elegir mascota, profesional, fecha, estado y motivo; si está atendida, ingresar el importe en pesos, por ejemplo 15.000,50. Al guardar, se actualizan los totales y se vuelve al período completo.
10. Exportar CSV y cerrar sesión. Probar una contraseña incorrecta.

## Reglas de los indicadores

El porcentaje atendido es `100 × atendidas / (atendidas + ausentes)`. Programadas y canceladas se excluyen, porque no son turnos realizados o faltados. No es un puntaje clínico ni una evaluación del profesional: indica la concreción de los turnos para revisar agenda y ausentismo.

Verde: ≥80%. Amarillo: ≥60% y <80%. Rojo: <60%. Sin datos: no hay turnos evaluables. Los umbrales son propuestos para este caso académico, no estándares veterinarios. Se redondea a un decimal y se clasifica el valor mostrado.

Todos los indicadores respetan los filtros. Filtrar solamente por atendidas produce 100%; solamente por ausentes produce 0%. Para comparar asistencia general, dejar Estado en Todos. El total cobrado suma los importes registrados: la pantalla, el formulario y el CSV usan pesos con puntos para miles y coma decimal. La base guarda importe_pesos, con hasta dos decimales; las sumas se calculan en unidades enteras mínimas para evitar errores de precisión; el importe siempre es no negativo y sólo las consultas atendidas pueden tener un cobro. No se interpreta como ganancia porque no se modelaron costos.

Las fechas se guardan como texto ISO en hora de Argentina, sin offset. La carga inicial abarca julio a octubre de 2026. El selector muestra el período completo con sus meses y se amplía cuando se agrega una consulta en un mes nuevo. La sesión vence con el reloj real del servidor. Los datos no cambian de estado automáticamente: el formulario permite agregar consultas a mascotas y veterinarios existentes. Las consultas se pueden editar y eliminar desde su detalle.

## Modelo

Dueño 1 → N Mascotas. Mascota 1 → N Consultas. Veterinario 1 → N Consultas. Una consulta tiene exactamente una mascota y un veterinario. Su dueño se obtiene desde la mascota, evitando duplicar ese dato. El modelo supone un dueño por mascota, un veterinario por consulta y ningún solapamiento en el mismo instante para esa mascota o profesional. La titularidad histórica no se modela.

Usuarios y sesiones son apoyo técnico: no cuentan entre las cuatro entidades relevantes. La contraseña utiliza PBKDF2 SHA-256 con salt y 100.000 iteraciones. El token de sesión se guarda como digest y se transmite en una cookie HttpOnly, SameSite=Strict; Secure cuando se usa HTTPS. Las sesiones duran ocho horas y cerrar sesión las invalida.

## Archivos para estudiar

- `sql/01_esquema.sql`: tablas, claves y restricciones.
- `sql/02_datos_ejemplo.sql`: INSERT completos de las cuatro entidades.
- `sql/03_consultas.sql`: consultas explicadas de indicadores, niveles y login.
- `sql/04_practica.sql`: siete ejercicios iniciales con resultados esperados.
- `lib/panel.mjs`: SELECT realmente ejecutados y filtros con bind.
- `lib/auth.mjs`: validación del acceso y sesiones.
- `public/app.js`: interfaz y navegación, JavaScript sin framework.
- `public/styles.css`: diseño adaptable a computadora y móvil.
- `practicar.mjs`: ejecutar SELECT sobre la base local en modo de sólo lectura.

## Practicar sin instalar un gestor

Primero iniciar el sistema para crear la base. Luego, en otra terminal dentro de esta carpeta:

```bash
node practicar.mjs "SELECT id, nombre, especie FROM mascotas LIMIT 5"
node practicar.mjs "SELECT COUNT(*) AS atendidas FROM consultas WHERE estado='atendida'"
```

La consola muestra las filas como tabla. Usar los ejercicios de `sql/04_practica.sql`. Para consultas de varias líneas, escribirlas en una sola línea entre comillas dobles. El ejecutor sólo admite SELECT y abre la base en modo de lectura.

## Verificación

```bash
npm test
```

Veintiséis pruebas verifican autenticación, totales contra una enumeración independiente, navegación y pertenencia de detalle, filtros, resultados vacíos, semáforo, integridad de las relaciones, carga repetible, importación del SQL y servidor HTTP. Incluyen altas autenticadas, validación de importes y fechas, rechazo de turnos duplicados y concordancia entre sumas mensuales y totales. También se verificó la sintaxis de JavaScript. No se realizó una prueba de interacción visual en navegador en este entorno; revisar esa parte al ejecutar en la Mac.

El ZIP no contiene bases creadas durante las pruebas. El sistema queda preparado para funcionar de forma independiente.

Para actualizar una instalación existente, reemplazar los archivos del proyecto conservando la carpeta data. Reiniciar el servidor y recargar la página. Los ejemplos SQL con resultados fijos corresponden a la carga inicial; agregar consultas cambia esos resultados.

## Editar y eliminar consultas

En el listado de Consultas, seleccioná Ver consulta para abrir el detalle. Allí están **Editar consulta** y **Eliminar consulta**. La edición permite modificar mascota, veterinario, fecha, tipo, estado, motivo e importe. La eliminación requiere confirmación y borra solamente esa consulta. Ambas acciones recalculan los indicadores desde SQLite. Desde un historial de dueño, mascota o tipo vuelven a ese historial conservando sus filtros; desde el panorama vuelven al período completo. El CSV siguiente refleja los cambios.

Para actualizar una instalación existente, conservá tu carpeta `data`, reemplazá los archivos del proyecto, reiniciá con `npm start` y recargá el navegador. No hay cambios de esquema.

## Conversión de la base existente a pesos

Cerrá la base en DB Browser antes de reiniciar el servidor actualizado. Al arrancar con `npm start`, el sistema convierte automáticamente `importe_centavos` a `importe_pesos`, dividiendo los valores por 100 una sola vez. Conserva consultas, identificadores, relaciones y sesiones. Antes crea un respaldo `data/veterinaria.sqlite.antes-pesos-<fecha>.bak`. No borres tu carpeta `data`. Después abrí nuevamente `data/veterinaria.sqlite` en DB Browser. SQLite muestra números sin separadores de miles; la interfaz y el CSV usan el formato argentino.

## Gestionar registros

La sección Gestionar registros incluye todos los clientes, mascotas y veterinarios, incluso sin consultas. No usa los filtros del panorama. La vista Dueños mantiene el análisis por cliente.

- Nuevo cliente: completar nombre y teléfono, y agregar una o varias mascotas opcionales. Si una mascota es inválida, no se guarda ningún registro de ese formulario.
- Nueva mascota: elegir su cliente, nombre y especie. También se puede agregar desde la fila del cliente.
- Nuevo veterinario: nombre y matrícula única. Se puede acceder a su actividad sin un límite de cuatro profesionales.
- Editar: modificar los datos sin perder las consultas anteriores.
- Dar de baja y conservar historial: guarda activo=0. No recibe turnos nuevos; los totales históricos permanecen. La baja de un cliente impide nuevos turnos para sus mascotas. Reactivar al cliente vuelve a habilitar las mascotas que no tengan su propia baja.
- Eliminar definitivamente: exige confirmación explícita y muestra mascotas, consultas e importe afectados. Eliminar un cliente borra sus mascotas y sus consultas. Eliminar un veterinario borra sus consultas, conservando mascotas y clientes. Eliminar una mascota conserva su cliente. Si cambian los conteos o el importe antes de confirmar, hay que volver a revisar el resumen.

Al iniciar una base anterior, se guarda un respaldo data/veterinaria.sqlite.antes-abm-*.bak antes de agregar activo a las tres tablas. No se cambian los IDs ni los importes. Cerrar DB Browser y detener el servidor antes de actualizar; conservar toda la carpeta data y volver a ejecutar npm start. En DB Browser se puede comprobar el campo activo.

Los registros de baja aparecen en Gestionar registros y en su historial. Se permite corregir una consulta anterior conservando su mascota y profesional inactivos, pero no asignarla a otro registro de baja. La aplicación no cambia automáticamente los estados de los turnos pendientes existentes.

Veintiséis pruebas cubren también guardado atómico, bajas y reactivación, eliminación por relación, restricciones, autenticación y migración con respaldo. Falta comprobar la apariencia y la interacción en el navegador del usuario.

## Drill down y drill up por dueño

1. Dueños: resumen de cantidad de consultas e importe por dueño.
2. Ver consultas: historial del dueño seleccionado, con mascota, fecha, veterinario, estado e importe.
3. Elegir una consulta: detalle completo de esa atención.

Los botones Volver a las consultas del dueño y Volver a Dueños permiten subir un nivel. La ruta superior también es clickeable. Se conservan mes, estado y búsqueda en ambos sentidos. El CSV del historial contiene las consultas del dueño con los filtros actuales. La validación SQL impide mostrar en el detalle consultas de otro dueño. Editar o eliminar desde ese recorrido vuelve al historial del mismo dueño.

Veintiséis pruebas aprobadas, incluyendo niveles de navegación, filtros, pertenencia del detalle y exportación del historial. No requiere migrar la base para este cambio.

## Drill down y drill up por mascota

En Mascotas, Ver consultas abre el historial de esa mascota (nivel 2). Elegir una consulta abre su detalle (nivel 3). El resumen de Mascotas es el nivel 1. Volver a las consultas de la mascota y Volver a Mascotas permiten subir; la ruta superior también es clickeable. Se conservan mes, estado y búsqueda. La exportación del historial contiene sus consultas filtradas. La base valida que cada detalle corresponda a la mascota elegida. El historial permanece accesible para mascotas de baja que conservan consultas.

Hay recorridos de tres niveles por veterinario, dueño, mascota y tipo de consulta. Este cambio no requiere migración de la base. Veintiséis pruebas aprobadas.

## Drill down y drill up por tipo de consulta

1. Panorama: el gráfico Consultas por tipo resume los turnos agrupados por tipo (nivel 1).
2. Elegir Control, Vacunación, Urgencia o Consulta general abre las consultas de ese tipo (nivel 2).
3. Ver consulta abre una atención concreta y sus relaciones (nivel 3).

Volver a las consultas del tipo seleccionado y Volver al panorama suben un nivel. La ruta superior también permite volver. Se conservan mes, estado y búsqueda. La lista evita repetir el tipo en cada fila porque aparece en el encabezado. Exportar CSV incluye sólo las consultas filtradas del tipo; desde el detalle exporta esa atención. SQLite valida el tipo y la pertenencia del detalle. Editar o eliminar vuelve al historial seleccionado; si el cambio deja de cumplir sus filtros, la consulta ya no aparece allí.

En sql/03_consultas.sql, los ejemplos 10 a 14 muestran GROUP BY para el resumen, WHERE para seleccionar un tipo, dueño o mascota, y JOIN para reunir el detalle. Se pueden ejecutar por separado en DB Browser sobre data/veterinaria.sqlite. Usan IDs de ejemplo y no requieren parámetros; reemplazarlos por los registros elegidos. Los comentarios explican cómo conservar mes y estado. No hay cambios de esquema para esta navegación.

## Ficha de cada mascota

Tocar el nombre de una mascota en Mascotas, los listados de consultas, el detalle de una consulta o Gestionar registros abre su ficha. Muestra ID, nombre, especie, estado, dueño, teléfono y estado del dueño. Los datos de la ficha no desaparecen si los filtros no encuentran consultas; también se puede consultar una mascota de baja o sin atenciones desde Gestionar registros.

Ver consultas de la mascota abre su historial con mes, estado y búsqueda conservados. Desde allí, Ver consulta abre una atención. Volver a las consultas, Volver a la ficha y Volver a la pantalla anterior permiten deshacer el recorrido; el último recupera la pantalla original, incluso una consulta específica. La ruta superior también permite navegar. La ficha muestra por separado la cantidad total histórica y la cantidad con los filtros actuales; exportar desde ella descarga sus datos.

El enlace Ver consultas de la tabla de Mascotas sigue abriendo directamente el historial. El nombre abre los datos del paciente. Los nombres dentro de selectores de formularios se usan para elegir una mascota. No se agrega información que la base no registre y no se necesita cambiar el esquema.
