ALTER TABLE "tareas" ADD COLUMN "afiliado_asignado_id" uuid;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "finalizada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_afiliado_asignado_id_usuarios_id_fk" FOREIGN KEY ("afiliado_asignado_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;