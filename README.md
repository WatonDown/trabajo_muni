# CircularMuni

Plataforma municipal para declarar, retirar, trazar y certificar residuos reciclables de empresas.

## Ejecutar

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. El dashboard conserva un modo demostración. Para datos reales, usa **Ingresar con Supabase** desde el menú de usuario o abre `/login` y registra una empresa.

## Supabase

El proyecto ya está conectado mediante `.env.local`. La base incluye municipalidades, organizaciones, usuarios, membresías y roles, establecimientos, tipos y declaraciones de residuos, solicitudes e ítems de retiro, historial de estados, certificados, notificaciones y auditoría. Todos los datos empresariales están protegidos con RLS multiempresa.

Las migraciones reproducibles están en `supabase/migrations/`. Los buckets privados `waste-evidence` y `certificates` están preparados para fotografías, documentos y certificados PDF.

## Flujo operativo

1. La empresa se registra y crea automáticamente su organización y establecimiento.
2. Declara el residuo con cantidad, origen, almacenamiento y fecha.
3. Solicita retiro de los residuos disponibles.
4. Un gestor municipal autorizado confirma, recolecta y registra peso efectivo.
5. La planta receptora informa la valorización y se emite el certificado.
6. La municipalidad consulta trazabilidad, cumplimiento y auditoría por organización.
