const { getDatabase, getDatabaseHelper } = require('../config/database');
const bcrypt = require('bcryptjs');

async function seed() {
    console.log('[Seed] Iniciando população de dados de demonstração...');
    const db = getDatabase();
    const dbHelper = getDatabaseHelper();

    // 1. Cria usuário de demonstração se não existir
    const demoEmail = 'demo@cesinha.com';
    let user = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);

    if (!user) {
        const passwordHash = await bcrypt.hash('demo123', 10);
        const res = db.prepare(`
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        `).run('Dr. César Albuquerque', demoEmail, passwordHash, 'admin');
        user = { id: Number(res.lastInsertRowid) };
        console.log('[Seed] Usuário demo criado:', demoEmail, '(Senha: demo123)');
    }

    const userId = user.id;

    // Verifica se já existem projetos
    const count = db.prepare('SELECT COUNT(*) as total FROM projects WHERE user_id = ?').get(userId).total;
    if (count > 0) {
        console.log(`[Seed] O usuário já possui ${count} projetos cadastrados. Pulando seed.`);
        return;
    }

    // Calcula datas relativas baseadas em hoje
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
            end_date: upcomingEndDateStr, // Alerta: vence em 3 dias!
            evaluation_analysis: 'Rendimento lipídico mínimo de 35% de biomassa seca e estabilidade microbiológica por 60 dias.',
            status: 'Em Andamento',
            activities: [
                { description: 'Montagem dos módulos fotobiorreatores e calibração de fluxo de CO2', target_date: pastDateStr, status: 'Concluída' },
                { description: 'Inoculação da cepa pura e controle de fotoperíodo (16h luz / 8h escuro)', target_date: overdueActivityDateStr, status: 'Concluída' },
                { description: 'Extração por solvente e quantificação cromatográfica de ésteres graxos', target_date: nearActivityDateStr, status: 'Em Andamento' },
                { description: 'Relatório consolidado e auditoria de pureza química', target_date: upcomingEndDateStr, status: 'Pendente' }
            ]
        },
        {
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
            end_date: overdueEndDateStr, // Alerta: ATRASADO há 4 dias!
            evaluation_analysis: 'Conformidade com a Resolução CONAMA nº 357/2005 para águas doces Classe 2.',
            status: 'Em Andamento',
            activities: [
                { description: 'Instalação de sondas multiparâmetros nos pontos P1 e P2', target_date: pastDateStr, status: 'Concluída' },
                { description: 'Coleta semanal e testes de toxicidade aguda com Ceriodaphnia dubia', target_date: overdueActivityDateStr, status: 'Em Andamento' },
                { description: 'Entrega do relatório técnico à CETESB com plano de mitigação', target_date: overdueEndDateStr, status: 'Pendente' }
            ]
        },
        {
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
            end_date: futureEndDateStr, // No Prazo (+45 dias)
            evaluation_analysis: 'Redução de 20% no consumo de solução nutritiva e aumento de 15% na biomassa foliar em 45 dias.',
            status: 'Em Andamento',
            activities: [
                { description: 'Levantamento topográfico e especificações de sensores de pH/EC', target_date: todayStr, status: 'Concluída' },
                { description: 'Programação de firmware e integração com gateway LoRaWAN', target_date: nearActivityDateStr, status: 'Em Andamento' },
                { description: 'Calibração dos dosadores de ácido e fertilizante quelatizado', target_date: futureEndDateStr, status: 'Pendente' }
            ]
        }
    ];

    dbHelper.transaction((client) => {
        for (const proj of sampleProjects) {
            const res = client.prepare(`
                INSERT INTO projects (
                    user_id, name, project_date, classification, type,
                    responsible_name, responsible_email, responsible_phone,
                    objective, location, start_date, end_date,
                    evaluation_analysis, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                userId, proj.name, proj.project_date, proj.classification, proj.type,
                proj.responsible_name, proj.responsible_email, proj.responsible_phone,
                proj.objective, proj.location, proj.start_date, proj.end_date,
                proj.evaluation_analysis, proj.status
            );

            const projId = Number(res.lastInsertRowid);
            const actStmt = client.prepare(`
                INSERT INTO project_activities (project_id, description, target_date, status)
                VALUES (?, ?, ?, ?)
            `);

            for (const act of proj.activities) {
                actStmt.run(projId, act.description, act.target_date, act.status);
            }
        }
    });

    console.log('[Seed] População concluída com sucesso! 3 projetos de exemplo adicionados.');
}

// Permite execução direta via CLI ou importação
if (require.main === module) {
    seed().then(() => process.exit(0)).catch(err => {
        console.error('[Seed Error]', err);
        process.exit(1);
    });
}

module.exports = seed;
