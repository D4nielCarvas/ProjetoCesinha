const { supabase, isSupabaseConfigured } = require('../config/supabase');
const bcrypt = require('bcryptjs');

async function seedSupabase() {
    if (!isSupabaseConfigured()) {
        console.log('[Supabase Seed] Supabase não configurado. Pulando.');
        return;
    }

    console.log('[Supabase Seed] Conectando ao Supabase para verificar dados...');

    // 1. Cria usuário demo se não existir
    const demoEmail = 'demo@cesinha.com';
    const { data: existingUser, error: findErr } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', demoEmail)
        .maybeSingle();

    let userId;
    if (!existingUser) {
        const passwordHash = await bcrypt.hash('demo123', 10);
        const { data: newUser, error: createErr } = await supabase
            .from('users')
            .insert({
                name: 'Dr. César Albuquerque',
                email: demoEmail,
                password_hash: passwordHash,
                role: 'admin'
            })
            .select()
            .single();

        if (createErr) {
            console.error('[Supabase Seed Error] Falha ao criar usuário demo:', createErr);
            return;
        }
        userId = newUser.id;
        console.log('[Supabase Seed] Usuário demo criado com sucesso:', demoEmail);
    } else {
        userId = existingUser.id;
        console.log('[Supabase Seed] Usuário demo existente (ID ' + userId + ').');
    }

    // 2. Verifica se já existem projetos
    const { count, error: countErr } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (count && count > 0) {
        console.log(`[Supabase Seed] O usuário já possui ${count} projetos no Supabase. Pulando inserção de amostras.`);
        return;
    }

    // 3. Datas dinâmicas para o cronograma
    const now = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    const todayStr = formatDate(now);

    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 25);
    const pastDateStr = formatDate(pastDate);

    const overdueEndDate = new Date(now);
    overdueEndDate.setDate(overdueEndDate.getDate() - 4);
    const overdueEndDateStr = formatDate(overdueEndDate);

    const upcomingEndDate = new Date(now);
    upcomingEndDate.setDate(upcomingEndDate.getDate() + 3);
    const upcomingEndDateStr = formatDate(upcomingEndDate);

    const futureEndDate = new Date(now);
    futureEndDate.setDate(futureEndDate.getDate() + 45);
    const futureEndDateStr = formatDate(futureEndDate);

    const nearActivityDate = new Date(now);
    nearActivityDate.setDate(nearActivityDate.getDate() + 2);
    const nearActivityDateStr = formatDate(nearActivityDate);

    const overdueActivityDate = new Date(now);
    overdueActivityDate.setDate(overdueActivityDate.getDate() - 2);
    const overdueActivityDateStr = formatDate(overdueActivityDate);

    // Projetos de Exemplo
    const sampleProjects = [
        {
            user_id: userId,
            name: 'Cultivo de Microalgas para Biocombustível (B20)',
            project_date: pastDateStr,
            classification: 'Experimento',
            type: 'Interno',
            responsible_name: 'Dra. Camila Duarte',
            responsible_email: 'camila.duarte@biotech.org',
            responsible_phone: '(19) 98123-4567',
            objective: 'Isolamento e cultivo de Chlorella vulgaris em fotobiorreatores para extração de lipídios combustíveis com alta densidade energética.',
            location: 'Laboratório de Bioprocessos - Módulo B',
            start_date: pastDateStr,
            end_date: upcomingEndDateStr,
            evaluation_analysis: 'Rendimento lipídico mínimo de 35% de biomassa seca e estabilidade microbiológica por 60 dias.',
            status: 'Em Andamento',
            responsibles: [
                { name: 'Dra. Camila Duarte', email: 'camila.duarte@biotech.org', phone: '(19) 98123-4567' }
            ],
            locations: ['Laboratório de Bioprocessos - Módulo B'],
            activities: [
                { description: 'Montagem dos módulos fotobiorreatores e calibração de fluxo de CO2', target_date: pastDateStr, status: 'Concluída' },
                { description: 'Inoculação da cepa pura e controle de fotoperíodo (16h luz / 8h escuro)', target_date: overdueActivityDateStr, status: 'Concluída' },
                { description: 'Extração por solvente e quantificação cromatográfica de ésteres graxos', target_date: nearActivityDateStr, status: 'Em Andamento' },
                { description: 'Relatório consolidado e auditoria de pureza química', target_date: upcomingEndDateStr, status: 'Pendente' }
            ]
        },
        {
            user_id: userId,
            name: 'Monitoramento de Efluentes Agroindustriais - Rio Jundiaí',
            project_date: pastDateStr,
            classification: 'Monitoramento',
            type: 'Parceiro',
            responsible_name: 'Eng. Ricardo Silveira',
            responsible_email: 'ricardo.silveira@ambienta.com.br',
            responsible_phone: '(11) 97654-3210',
            objective: 'Rastreamento contínuo de Demanda Química de Oxigênio (DQO), nitrogênio amoniacal e turbidez em 4 pontos críticos de descarte fabril.',
            location: 'Bacia Hidrográfica do Médio Tietê / Jundiaí - SP',
            start_date: pastDateStr,
            end_date: overdueEndDateStr,
            evaluation_analysis: 'Conformidade com a Resolução CONAMA nº 357/2005 para águas doces Classe 2.',
            status: 'Em Andamento',
            responsibles: [
                { name: 'Eng. Ricardo Silveira', email: 'ricardo.silveira@ambienta.com.br', phone: '(11) 97654-3210' }
            ],
            locations: ['Bacia Hidrográfica do Médio Tietê / Jundiaí - SP'],
            activities: [
                { description: 'Instalação de sondas multiparâmetros nos pontos P1 e P2', target_date: pastDateStr, status: 'Concluída' },
                { description: 'Coleta semanal e testes de toxicidade aguda com Ceriodaphnia dubia', target_date: overdueActivityDateStr, status: 'Em Andamento' },
                { description: 'Entrega do relatório técnico à CETESB com plano de mitigação', target_date: overdueEndDateStr, status: 'Pendente' }
            ]
        },
        {
            user_id: userId,
            name: 'Estudo de Caso: Automação Inteligente de Estufas Hidropônicas',
            project_date: todayStr,
            classification: 'Estudo de caso',
            type: 'Interno',
            responsible_name: 'Dr. César Albuquerque',
            responsible_email: demoEmail,
            responsible_phone: '(11) 99988-7766',
            objective: 'Análise de viabilidade técnica e financeira da implantação de microcontroladores IoT com telemetria para dosagem de nutrientes NPK.',
            location: 'Fazenda Experimental de Hortaliças - Mogi das Cruzes',
            start_date: todayStr,
            end_date: futureEndDateStr,
            evaluation_analysis: 'Redução de 20% no consumo de solução nutritiva e aumento de 15% na biomassa foliar em 45 dias.',
            status: 'Em Andamento',
            responsibles: [
                { name: 'Dr. César Albuquerque', email: demoEmail, phone: '(11) 99988-7766' }
            ],
            locations: ['Fazenda Experimental de Hortaliças - Mogi das Cruzes'],
            activities: [
                { description: 'Levantamento topográfico e especificações de sensores de pH/EC', target_date: todayStr, status: 'Concluída' },
                { description: 'Programação de firmware e integração com gateway LoRaWAN', target_date: nearActivityDateStr, status: 'Em Andamento' },
                { description: 'Calibração dos dosadores de ácido e fertilizante quelatizado', target_date: futureEndDateStr, status: 'Pendente' }
            ]
        }
    ];

    for (const proj of sampleProjects) {
        const { responsibles, locations, activities, ...projectFields } = proj;

        const { data: createdProject, error: projErr } = await supabase
            .from('projects')
            .insert(projectFields)
            .select()
            .single();

        if (projErr) {
            console.error('[Supabase Seed Error] Falha ao criar projeto:', projErr);
            continue;
        }

        const projId = createdProject.id;

        // Insere atividades
        if (activities && activities.length > 0) {
            const actRows = activities.map(a => ({ ...a, project_id: projId }));
            await supabase.from('project_activities').insert(actRows);
        }

        // Insere responsáveis
        if (responsibles && responsibles.length > 0) {
            const respRows = responsibles.map(r => ({ ...r, project_id: projId }));
            await supabase.from('project_responsibles').insert(respRows);
        }

        // Insere locais
        if (locations && locations.length > 0) {
            const locRows = locations.map(l => ({ name: typeof l === 'string' ? l : l.name, project_id: projId }));
            await supabase.from('project_locations').insert(locRows);
        }

        console.log(`[Supabase Seed] Projeto "${createdProject.name}" populado com sucesso.`);
    }

    console.log('[Supabase Seed] Processo de seed concluído no Supabase!');
}

if (require.main === module) {
    seedSupabase().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = seedSupabase;
