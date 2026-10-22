# Correcciones de esta versión

- Consultas agendadas: desglose completo de atendidas, ausentes, pendientes y canceladas.
- Porcentaje explicado con el numerador y denominador; excluye pendientes y canceladas.
- Período completo muestra los meses inicial y final con nombres completos y se adapta a registros nuevos.
- Nueva consulta guarda en SQLite y actualiza todo el panorama. No depende de Firebase ni internet.
- Se retira la etiqueta de corte histórico fijo.
- Pesos en formularios, pantallas y CSV; importe_pesos y separadores argentinos.
- Tarjetas adaptables; monto con dos decimales y tamaño según ancho de tarjeta.
- Once pruebas aprobadas: sumas de meses y tipos, alta con validaciones, importes, filtros, relaciones y acceso.
- No se reprodujo la diferencia de 48 frente a 45 con los datos originales. La suma verificada es 11 + 10 + 12 + 12 = 45.
- Pendiente: comprobar la apariencia visual en navegador.

- ABM de consultas: edición precargada y eliminación con confirmación desde el detalle.
- UPDATE y DELETE autenticados, con las mismas validaciones de fechas, importes y horarios que el alta.
- Actualización del panorama y exportación después de cada cambio; se conserva la base existente.

- Columna importe_pesos en la base SQLite y en los ejercicios SQL. Conversión automática desde bases anteriores con copia de respaldo previa.

- ABM de clientes, mascotas y veterinarios en Gestionar registros; baja reversible con historial y eliminación confirmada con resumen de impacto.
- Cliente nuevo con varias mascotas en una operación atómica.
- Respaldo y migración automática del campo activo; 18 pruebas aprobadas.

- Tres niveles desde Dueños: resumen → historial del dueño → detalle de consulta; drill up y ruta superior conservan filtros y origen.
- CSV del historial y validación del dueño en SQL. Veinte pruebas aprobadas.

- Tres niveles por mascota: resumen → historial de la mascota → detalle; drill up, filtros y exportación. Veintidós pruebas aprobadas.

- Historial de una mascota: Tipo es la primera columna; mascota y dueño aparecen en el encabezado. Ver consulta identifica la acción para abrir cada atención en todas las listas.

- Consultas por tipo es clickeable: panorama → consultas del tipo → detalle, con drill up y filtros conservados. Se evita repetir el tipo en cada fila del historial.
- Ejemplos SQL 10 a 14 ejecutables en DB Browser: resumen por tipo, historiales por tipo/dueño/mascota y detalle con JOIN.
- Veinticuatro pruebas aprobadas, incluyendo pertenencia del detalle, filtros, navegación, CSV y concordancia de los ejemplos SQL. Apariencia en navegador pendiente.

- Nombre de mascota clickeable en resumen de Mascotas, listas de consultas, detalle e historial y Gestionar registros. Abre la ficha del paciente, no una consulta.
- Ficha con datos y dueño, estados, total histórico y enlace a sus consultas. Vuelta a la ficha y a la pantalla original con filtros conservados; disponible para mascotas sin consultas o de baja.
- Veintiséis pruebas aprobadas; se verifican datos, enlaces, navegación, URL y CSV de la ficha. Revisión visual en navegador pendiente.
