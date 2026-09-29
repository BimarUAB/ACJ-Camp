# Pruebas de aceptación ACJ Camp

Los casos requieren una base PostgreSQL con PostGIS, variables configuradas y dos sesiones de navegador. Ejecutar después de instalar `schema.sql` (o `migrate.sql` si la base ya existía). `Satisfecho` significa verificado de extremo a extremo; el build por sí solo no confirma comportamiento con datos.

| Caso | Comprobación | Resultado esperado | Estado |
| --- | --- | --- | --- |
| Registro único | Registrar dos veces el mismo correo | El segundo intento se rechaza y no expone detalles internos | No satisfecho: pendiente de ejecutar con PostgreSQL |
| Roles | Iniciar sesión como líder, director y admin | Cada rol accede solo a sus acciones; el cambio de rol se aplica en la petición siguiente | No satisfecho: pendiente de ejecutar con PostgreSQL |
| Límite por IP | Enviar seis intentos de login en un minuto desde una IP | El sexto intento recibe HTTP 429 | No satisfecho: pendiente de ejecutar con API desplegada |
| Bloqueo de cuenta | Fallar cinco veces para una cuenta existente | La cuenta queda bloqueada durante 15 minutos y se libera después | No satisfecho: pendiente de ejecutar con PostgreSQL |
| Lugares y aprobación | Crear lugar como director; aprobar y rechazar como admin | La propuesta no aparece al público hasta aprobarla | No satisfecho: pendiente de ejecutar con PostgreSQL y Cloudinary |
| Alta y edición propia | Crear como usuario autenticado, verlo en Mis lugares y editarlo | Se conserva el propietario, se actualizan campos y el estado de aprobación no lo puede cambiar el autor | No satisfecho: base local en recuperación; UI/API implementadas |
| Distancia PostGIS | Buscar autenticado con iglesia georreferenciada | Devuelve solo lugares dentro de 50 km y calcula distancia en SQL | No satisfecho: pendiente de ejecutar con PostGIS |
| Reserva sin conflicto | Crear reservas contiguas y luego una con fecha compartida | La contigua se acepta; la solapada responde HTTP 400 incluso en concurrencia | No satisfecho: falta instalar `btree_gist` en la base local |
| Cancelación e historial | Cancelar una reserva propia y consultar el historial | Cambia a cancelada, conserva el registro y libera las fechas | No satisfecho: pendiente de ejecutar con PostgreSQL |
| Reseña auténtica | Intentar reseñar sin reserva, con reserva pendiente y con una completada | Solo la reserva completada propia permite publicar; autor y fecha aparecen | No satisfecho: pendiente de ejecutar con PostgreSQL |
| Panel y Excel | Abrir reportes como admin y descargar el archivo | KPIs, zona, popularidad y archivo `.xlsx` con encabezados en español | No satisfecho: pendiente de ejecutar con PostgreSQL |
| Capa de campings OSM | Activar/desactivar puntos, mover el mapa y actualizar en La Paz | Aparecen campings/caravanas de OSM, sus fichas abren el objeto fuente y la consulta sigue el área visible | Satisfecho: el endpoint devolvió 7 puntos y el mapa mostró 5 dentro del viewport móvil |
| Compilación frontend | `npm run build --prefix frontend` | Vite genera `frontend/dist` sin errores | Satisfecho: build local completado |
| Sintaxis backend | `node --check` en controladores y rutas editados | Sin errores de sintaxis | Satisfecho: chequeo local completado |