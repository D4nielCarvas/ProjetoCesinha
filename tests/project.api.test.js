const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server/app');
const { getDatabase } = require('../server/config/database');

describe('Integração API - Autenticação e Gestão de Projetos', () => {
    let server;
    let baseUrl;
    let authToken;
    let createdProjectId;
    let activityIdToTest;

    before(async () => {
        // Inicializa o banco de dados
        getDatabase();

        // Inicia servidor em porta dinâmica disponível (porta 0)
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}/api`;
                resolve();
            });
        });
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test('1. Registro de novo usuário deve retornar 201 e token JWT', async () => {
        const uniqueEmail = `eng_${Date.now()}@teste.com`;
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Engenheiro de Testes',
                email: uniqueEmail,
                password: 'senhaSegura123'
            })
        });

        assert.equal(res.status, 201);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.data.token);
        assert.equal(data.data.user.email, uniqueEmail);
        
        authToken = data.data.token;
    });

    test('2. Rota de projetos sem autenticação deve retornar 401', async () => {
        const res = await fetch(`${baseUrl}/projects`);
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.success, false);
    });

    test('3. Validação: Criar projeto com data de início posterior ao término deve retornar 400', async () => {
        const res = await fetch(`${baseUrl}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Projeto Inválido',
                projectDate: '2026-09-25',
                classification: 'Experimento',
                type: 'Interno',
                responsibleName: 'Carlos Silva',
                responsibleEmail: 'carlos@empresa.com',
                responsiblePhone: '(11) 98765-4321',
                objective: 'Objetivo de teste',
                location: 'Laboratório Central',
                startDate: '2026-10-10',
                endDate: '2026-09-10' // Início maior que término
            })
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.match(data.error, /posterior à Previsão/i);
    });

    test('4. Criar projeto completo com cronograma de etapas (1:N) deve retornar 201', async () => {
        const projectPayload = {
            name: 'Biofábrica Piloto 2026',
            projectDate: '2026-09-25',
            classification: 'Experimento',
            type: 'Interno',
            responsibleName: 'Dra. Helena Martins',
            responsibleEmail: 'helena.martins@biotech.com',
            responsiblePhone: '(19) 99876-5432',
            objective: 'Validação da síntese microbiológica com controle térmico automatizado.',
            location: 'Campinas - SP / Bloco Bio-3',
            startDate: '2026-09-01',
            endDate: '2026-10-15',
            evaluationAnalysis: 'Métricas de pureza acima de 98% e estabilidade em 30 dias.',
            activities: [
                {
                    description: 'Instalação dos biorreatores e calibração de sensores',
                    target_date: '2026-09-10',
                    status: 'Concluída'
                },
                {
                    description: 'Inoculação da cepa bacteriana sob agitação contínua',
                    target_date: '2026-09-28',
                    status: 'Em Andamento'
                },
                {
                    description: 'Coleta e análise cromatográfica das amostras',
                    target_date: '2026-10-12',
                    status: 'Pendente'
                }
            ]
        };

        const res = await fetch(`${baseUrl}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(projectPayload)
        });

        assert.equal(res.status, 201);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.data.id);
        assert.equal(data.data.activities.length, 3);
        assert.ok(data.data.deadline_info);
        
        createdProjectId = data.data.id;
        activityIdToTest = data.data.activities[1].id;
    });

    test('5. Listagem de projetos com filtros e cálculo de métricas', async () => {
        const res = await fetch(`${baseUrl}/projects?classification=Experimento`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.data.metrics.total >= 1);
        assert.ok(Array.isArray(data.data.projects));
        assert.ok(Array.isArray(data.data.notifications));
        
        const found = data.data.projects.find(p => p.id === createdProjectId);
        assert.ok(found);
        assert.equal(found.classification, 'Experimento');
    });

    test('6. Atualizar status de uma etapa individual do cronograma', async () => {
        const res = await fetch(`${baseUrl}/projects/${createdProjectId}/activities/${activityIdToTest}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: 'Concluída' })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);

        const updatedActivity = data.data.activities.find(a => a.id === activityIdToTest);
        assert.equal(updatedActivity.status, 'Concluída');
    });

    test('7. Exclusão de projeto deve remover o registro e suas etapas associadas', async () => {
        const deleteRes = await fetch(`${baseUrl}/projects/${createdProjectId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        assert.equal(deleteRes.status, 200);

        // Verifica que o projeto não pode mais ser acessado
        const getRes = await fetch(`${baseUrl}/projects/${createdProjectId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        assert.equal(getRes.status, 400);
    });

    test('8. Criar projeto com múltiplos responsáveis e múltiplos locais (1 ou mais)', async () => {
        const payloadMulti = {
            name: 'Genômica Funcional Integrada',
            projectDate: '2026-09-28',
            classification: 'Monitoramento',
            type: 'Parceiro',
            responsibles: [
                {
                    name: 'Dra. Ana Paula Silveira',
                    email: 'ana.silveira@genomica.org',
                    phone: '(11) 98765-1111'
                },
                {
                    name: 'Dr. Lucas B. Fagundes',
                    email: 'lucas.fagundes@pesquisa.usp.br',
                    phone: '(11) 91234-2222'
                }
            ],
            locations: [
                'Laboratório Central USP - Bloco 5',
                'Estação Experimental de Ribeirão Preto'
            ],
            objective: 'Mapeamento epigenético em amostras submetidas a estresse hídrico.',
            startDate: '2026-10-01',
            endDate: '2026-12-15',
            activities: [
                {
                    description: 'Sequenciamento NGS das amostras controle',
                    target_date: '2026-10-20',
                    status: 'Pendente'
                }
            ]
        };

        const res = await fetch(`${baseUrl}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payloadMulti)
        });

        assert.equal(res.status, 201);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.data.name, 'Genômica Funcional Integrada');
        assert.equal(data.data.responsibles.length, 2);
        assert.equal(data.data.responsibles[0].name, 'Dra. Ana Paula Silveira');
        assert.equal(data.data.responsibles[1].name, 'Dr. Lucas B. Fagundes');
        assert.equal(data.data.locations.length, 2);
        assert.equal(data.data.locations[0].name, 'Laboratório Central USP - Bloco 5');
        assert.equal(data.data.locations[1].name, 'Estação Experimental de Ribeirão Preto');

        // Teste de busca por responsável secundário (Lucas) e local secundário (Ribeirão Preto)
        const searchRespRes = await fetch(`${baseUrl}/projects?search=Fagundes`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const searchRespData = await searchRespRes.json();
        assert.ok(searchRespData.data.projects.some(p => p.id === data.data.id));

        const searchLocRes = await fetch(`${baseUrl}/projects?search=Ribeir%C3%A3o`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const searchLocData = await searchLocRes.json();
        assert.ok(searchLocData.data.projects.some(p => p.id === data.data.id));

        // Teste de atualização de responsáveis e locais
        const updateRes = await fetch(`${baseUrl}/projects/${data.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                ...payloadMulti,
                responsibles: [
                    {
                        name: 'Dra. Ana Paula Silveira',
                        email: 'ana.silveira@genomica.org',
                        phone: '(11) 98765-1111'
                    }
                ],
                locations: [
                    'Laboratório Central USP - Bloco 5',
                    'Centro de Bioinformática - Sala 12',
                    'Estação Experimental de Ribeirão Preto'
                ]
            })
        });

        assert.equal(updateRes.status, 200);
        const updatedData = await updateRes.json();
        assert.equal(updatedData.data.responsibles.length, 1);
        assert.equal(updatedData.data.locations.length, 3);
    });

    test('9. Validação: Deve rejeitar criação se nenhum responsável ou local for informado', async () => {
        // Sem responsáveis
        const resNoResp = await fetch(`${baseUrl}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Projeto Sem Responsável',
                projectDate: '2026-09-28',
                classification: 'Experimento',
                type: 'Interno',
                responsibles: [],
                locations: ['Local 1'],
                objective: 'Objetivo teste',
                startDate: '2026-10-01',
                endDate: '2026-11-01'
            })
        });
        assert.equal(resNoResp.status, 400);
        const dataNoResp = await resNoResp.json();
        assert.match(dataNoResp.error, /pelo menos um responsável/i);

        // Sem locais
        const resNoLoc = await fetch(`${baseUrl}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Projeto Sem Local',
                projectDate: '2026-09-28',
                classification: 'Experimento',
                type: 'Interno',
                responsibles: [{ name: 'Carlos', email: 'carlos@empresa.com', phone: '123' }],
                locations: [],
                objective: 'Objetivo teste',
                startDate: '2026-10-01',
                endDate: '2026-11-01'
            })
        });
        assert.equal(resNoLoc.status, 400);
        const dataNoLoc = await resNoLoc.json();
        assert.match(dataNoLoc.error, /pelo menos um local/i);
    });
});
