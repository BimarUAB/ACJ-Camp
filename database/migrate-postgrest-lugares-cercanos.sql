BEGIN;

CREATE SCHEMA IF NOT EXISTS api;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'campusab_postgrest_anon') THEN
        CREATE ROLE campusab_postgrest_anon
            NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END $$;

REVOKE ALL ON SCHEMA api FROM PUBLIC;
GRANT USAGE ON SCHEMA api TO campusab_postgrest_anon;
GRANT USAGE ON SCHEMA public TO campusab_postgrest_anon;

GRANT SELECT (
    id, nombre, descripcion, direccion, latitud, longitud,
    capacidad_maxima, servicios, precio_aprox, estado
) ON public.lugares_camping TO campusab_postgrest_anon;
GRANT SELECT (lugar_id, calificacion) ON public.resenas TO campusab_postgrest_anon;

DROP FUNCTION IF EXISTS api.lugares_cercanos(double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION api.lugares_cercanos(
    p_lat double precision,
    p_lng double precision,
    p_radio_km double precision DEFAULT 50
)
RETURNS TABLE (
    id integer,
    nombre text,
    descripcion text,
    direccion text,
    latitud double precision,
    longitud double precision,
    capacidad_maxima integer,
    servicios jsonb,
    precio_aprox numeric,
    distancia_km numeric,
    promedio_calificacion numeric(3,2)
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, api
AS $$
DECLARE
    origen public.geography;
BEGIN
    IF p_lat IS NULL OR p_lat < -90 OR p_lat > 90
       OR p_lng IS NULL OR p_lng < -180 OR p_lng > 180
       OR p_radio_km IS NULL OR p_radio_km < 0.1 OR p_radio_km > 5000 THEN
        RAISE EXCEPTION 'Coordenadas o radio fuera de rango'
            USING ERRCODE = '22023';
    END IF;

    origen := public.ST_SetSRID(public.ST_MakePoint(p_lng, p_lat), 4326)::public.geography;

    RETURN QUERY
    SELECT l.id,
           l.nombre::text,
           l.descripcion,
           l.direccion,
           l.latitud::double precision,
           l.longitud::double precision,
           l.capacidad_maxima,
           l.servicios,
           l.precio_aprox,
           ROUND((public.ST_Distance(
               public.ST_SetSRID(
                   public.ST_MakePoint(l.longitud::double precision, l.latitud::double precision),
                   4326
               )::public.geography,
               origen,
               false
           ) / 1000)::numeric, 2),
           COALESCE((
               SELECT AVG(resena.calificacion)
               FROM public.resenas resena
               WHERE resena.lugar_id = l.id
           ), 0)::numeric(3,2)
    FROM public.lugares_camping l
    WHERE l.estado = 'activo'
      AND public.ST_DWithin(
          public.ST_SetSRID(
              public.ST_MakePoint(l.longitud::double precision, l.latitud::double precision),
              4326
          )::public.geography,
          origen,
          p_radio_km * 1000
      )
    ORDER BY 10;
END;
$$;

REVOKE ALL ON FUNCTION api.lugares_cercanos(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.lugares_cercanos(double precision, double precision, double precision)
    TO campusab_postgrest_anon;

COMMIT;