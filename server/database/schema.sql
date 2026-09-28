-- ====================================================================
-- ESQUEMA 1: SQLITE (Utilizado nativamente nesta aplicação Node.js)
-- ====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    project_date DATE NOT NULL,
    classification VARCHAR(50) NOT NULL CHECK(classification IN ('Experimento', 'Monitoramento', 'Estudo de caso')),
    type VARCHAR(50) NOT NULL CHECK(type IN ('Interno', 'Parceiro')),
    responsible_name VARCHAR(150) NOT NULL,
    responsible_email VARCHAR(255) NOT NULL,
    responsible_phone VARCHAR(30) NOT NULL,
    objective TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    evaluation_analysis TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Em Andamento' CHECK(status IN ('Pendente', 'Em Andamento', 'Concluído', 'Cancelado')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_classification ON projects(classification);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS project_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    description VARCHAR(500) NOT NULL,
    target_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pendente' CHECK(status IN ('Pendente', 'Em Andamento', 'Concluída')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activities_project_id ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_target_date ON project_activities(target_date);
CREATE INDEX IF NOT EXISTS idx_activities_status ON project_activities(status);

-- Tabela de Responsáveis por Projeto (1 ou mais por projeto)
CREATE TABLE IF NOT EXISTS project_responsibles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_responsibles_project_id ON project_responsibles(project_id);
CREATE INDEX IF NOT EXISTS idx_responsibles_email ON project_responsibles(email);

-- Tabela de Locais por Projeto (1 ou mais por projeto)
CREATE TABLE IF NOT EXISTS project_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_locations_project_id ON project_locations(project_id);

-- ====================================================================
-- ESQUEMA 2: POSTGRESQL / SUPABASE COM ROW LEVEL SECURITY (RLS)
-- (Script pronto para migração para nuvem/PostgreSQL)
-- ====================================================================
/*
-- 1. Criação dos tipos enumerados para integridade estrita
CREATE TYPE project_classification_enum AS ENUM ('Experimento', 'Monitoramento', 'Estudo de caso');
CREATE TYPE project_type_enum AS ENUM ('Interno', 'Parceiro');
CREATE TYPE project_status_enum AS ENUM ('Pendente', 'Em Andamento', 'Concluído', 'Cancelado');
CREATE TYPE activity_status_enum AS ENUM ('Pendente', 'Em Andamento', 'Concluída');

-- 2. Tabela de Projetos associada ao schema auth do Supabase
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    project_date DATE NOT NULL DEFAULT CURRENT_DATE,
    classification project_classification_enum NOT NULL,
    type project_type_enum NOT NULL,
    responsible_name VARCHAR(150) NOT NULL,
    responsible_email VARCHAR(255) NOT NULL,
    responsible_phone VARCHAR(30) NOT NULL,
    objective TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    evaluation_analysis TEXT,
    status project_status_enum NOT NULL DEFAULT 'Em Andamento',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Atividades do Cronograma (1:N)
CREATE TABLE IF NOT EXISTS public.project_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    target_date DATE NOT NULL,
    status activity_status_enum NOT NULL DEFAULT 'Pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Tabela de Responsáveis por Projeto (1:N)
CREATE TABLE IF NOT EXISTS public.project_responsibles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Tabela de Locais por Projeto (1:N)
CREATE TABLE IF NOT EXISTS public.project_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Índices B-Tree para alta performance em filtros e junções
CREATE INDEX IF NOT EXISTS idx_pg_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_projects_classification ON public.projects(classification);
CREATE INDEX IF NOT EXISTS idx_pg_projects_type ON public.projects(type);
CREATE INDEX IF NOT EXISTS idx_pg_projects_end_date ON public.projects(end_date);
CREATE INDEX IF NOT EXISTS idx_pg_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_pg_activities_project_id ON public.project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_pg_activities_target_date ON public.project_activities(target_date);
CREATE INDEX IF NOT EXISTS idx_pg_responsibles_project_id ON public.project_responsibles(project_id);
CREATE INDEX IF NOT EXISTS idx_pg_locations_project_id ON public.project_locations(project_id);

-- 7. Ativação de Row Level Security (RLS) - Isolamento Multi-tenant
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_locations ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso: Cada usuário só gerencia seus próprios dados
CREATE POLICY "Usuários gerenciam seus próprios projetos"
ON public.projects FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários gerenciam atividades dos seus projetos"
ON public.project_activities FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_activities.project_id
        AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_activities.project_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Usuários gerenciam responsáveis dos seus projetos"
ON public.project_responsibles FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_responsibles.project_id
        AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_responsibles.project_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Usuários gerenciam locais dos seus projetos"
ON public.project_locations FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_locations.project_id
        AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_locations.project_id
        AND p.user_id = auth.uid()
    )
);
*/
