CREATE TABLE "tareas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"titulo" varchar(120) NOT NULL,
	"descripcion" text NOT NULL,
	"categoria" varchar(60) NOT NULL,
	"estado" varchar(20) DEFAULT 'abierta' NOT NULL,
	"ubicacion" varchar(200) NOT NULL,
	"latitud" double precision,
	"longitud" double precision,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;