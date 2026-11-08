CREATE TABLE "ofertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarea_id" uuid NOT NULL,
	"afiliado_id" uuid NOT NULL,
	"mensaje" text,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ofertas_tarea_afiliado_unique" UNIQUE("tarea_id","afiliado_id")
);
--> statement-breakpoint
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_tarea_id_tareas_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tareas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_afiliado_id_usuarios_id_fk" FOREIGN KEY ("afiliado_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;