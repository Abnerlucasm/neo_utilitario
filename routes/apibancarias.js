'use strict';

const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();


const {
    ApiBancariaCliente,
    ApiBancariaIntegracao,
    ApiBancariaApi,
    ApiBancariaCertificado,
} = require('../models/postgresql/associations');

// ─── Includes reutilizados ──────────────────────────────────────────────────
const clientInclude = [{
    model: ApiBancariaIntegracao,
    as: 'integrations',
    include: [{
        model: ApiBancariaApi,
        as: 'apis',
        include: [{ model: ApiBancariaCertificado, as: 'certificate' }],
    }],
}];

const certificateInclude = [{
    model: ApiBancariaApi,
    as: 'api',
    include: [{ model: ApiBancariaIntegracao, as: 'integration' }],
}];

function normalizeClientName(name) {
    return String(name || '').trim().toLocaleUpperCase('pt-BR');
}

// ─── Serializadores (mantêm o front-end simples) ────────────────────────────
function serializeClient(client) {
    return {
        id: client.id,
        name: client.name,
        document: client.document,
        notes: client.notes,
        integrations: (client.integrations || []).map((integ) => ({
            id: integ.id,
            bank: integ.bank,
            apis: (integ.apis || []).map((api) => ({
                id: api.id,
                name: api.name,
                certificateId: api.certificate?.id || null,
            })),
        })),
    };
}

function serializeCertificate(cert) {
    const api = cert.api;
    const integration = api?.integration;
    return {
        id: cert.id,
        apiId: cert.apiId,
        apiName: api?.name || null,
        bank: integration?.bank || null,
        clientId: integration?.clientId || null,
        label: cert.label,
        expiresOn: cert.expiresOn,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/clientes', async (req, res) => {
    try {
        const clients = await ApiBancariaCliente.findAll({
            include: clientInclude,
            order: [['name', 'ASC']],
        });
        res.json(clients.map(serializeClient));
    } catch (err) {
        console.error('[GET /clientes]', err);
        res.status(500).json({ error: 'Erro ao listar clientes' });
    }
});

router.post('/clientes', async (req, res) => {
    const t = await ApiBancariaCliente.sequelize.transaction();
    try {
        const { document, notes, integrations = [] } = req.body;
        const name = normalizeClientName(req.body.name);

        if (!name) {
            await t.rollback();
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const existing = await ApiBancariaCliente.findOne({
            where: { name: { [Op.iLike]: name } },
            transaction: t,
        });
        if (existing) {
            await t.rollback();
            return res.status(409).json({ error: 'Este cliente já está cadastrado'});
        }

        const client = await ApiBancariaCliente.create({
            name, document, notes,
            createdBy: req.user?.id || null,
        }, { transaction: t });

        for (const integ of integrations) {
            if (!integ.bank) continue;
            const integration = await ApiBancariaIntegracao.create({
                clientId: client.id, bank: integ.bank, createdBy: req.user?.id || null,
            }, { transaction: t });

            for (const apiName of (integ.apis || [])) {
                await ApiBancariaApi.create({
                    integrationId: integration.id, name: apiName,
                }, { transaction: t });
            }
        }

        await t.commit();
        const created = await ApiBancariaCliente.findByPk(client.id, { include: clientInclude });
        res.status(201).json(serializeClient(created));
    } catch (err) {
        await t.rollback();
        console.error('[POST /clientes]', err);
        res.status(500).json({ error: 'Erro ao criar cliente', details: err.message });
    }
});

router.put('/clientes/:id', async (req, res) => {
    const t = await ApiBancariaCliente.sequelize.transaction();
    try {
        const client = await ApiBancariaCliente.findByPk(req.params.id, { transaction: t });
        if (!client) { await t.rollback(); return res.status(404).json({ error: 'Cliente não encontrado' }); }

        const { document, notes, integrations = [] } = req.body;
        const name = normalizeClientName(req.body.name);

        if (!name) {
            await t.rollback();
            return res.status(400).json({ error: 'Nome obrigatório' });
        }

        const existing = await ApiBancariaCliente.findOne({
            where: { name: { [Op.iLike]: name }, id: { [Op.ne]: client.id } },
            transaction: t,
        });
        if (existing) {
            await t.rollback();
            return res.status(409).json({ error: 'Este cliente já está cadastrado'});
        }

        await client.update({
            name: name ?? client.name,
            document, notes,
            updatedBy: req.user?.id || null,
        }, { transaction: t });

        await ApiBancariaIntegracao.destroy({ where: { clientId: client.id }, transaction: t });

        for (const integ of integrations) {
            if (!integ.bank) continue;
            const integration = await ApiBancariaIntegracao.create({
                clientId: client.id, bank: integ.bank, createdBy: req.user?.id || null,
            }, { transaction: t });

            for (const apiName of (integ.apis || [])) {
                await ApiBancariaApi.create({
                    integrationId: integration.id, name: apiName,
                }, { transaction: t });
            }
        }

        await t.commit();
        const updated = await ApiBancariaCliente.findByPk(client.id, { include: clientInclude });
        res.json(serializeClient(updated));
    } catch (err) {
        await t.rollback();
        console.error('[PUT /clientes/:id]', err);
        res.status(500).json({ error: 'Erro ao atualizar cliente', details: err.message });
    }
});

router.delete('/clientes/:id', async (req, res) => {
    try {
        const deleted = await ApiBancariaCliente.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /clientes/:id]', err);
        res.status(500).json({ error: 'Erro ao remover cliente' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// CERTIFICADOS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/certificados', async (req, res) => {
    try {
        const certs = await ApiBancariaCertificado.findAll({
            include: certificateInclude,
            order: [['expires_on', 'ASC']],
        });
        res.json(certs.map(serializeCertificate));
    } catch (err) {
        console.error('[GET /certificados]', err);
        res.status(500).json({ error: 'Erro ao listar certificados' });
    }
});
//irá tratar no modelo 1:1 cada API/integração só pode ter 1 certificado
router.post('/certificados', async (req, res) => {
    try {
        const { apiId, label, expiresOn } = req.body;

        if (!apiId || !expiresOn) {
            return res.status(400).json({ error: 'Selecione a API e informe o vencimento' });
        }

        const existing = await ApiBancariaCertificado.findOne({ where: { apiId } });
        if (existing) {
            return res.status(409).json({ error: 'Esta API já possui um certificado. Edite o certificado existente.' });
        }

        const cert = await ApiBancariaCertificado.create({
            apiId, label, expiresOn, createdBy: req.user?.id || null,
        });

        const created = await ApiBancariaCertificado.findByPk(cert.id, { include: certificateInclude });
        res.status(201).json(serializeCertificate(created));
    } catch (err) {
        console.error('[POST /certificados]', err);
        res.status(500).json({ error: 'Erro ao criar certificado', details: err.message });
    }
});

router.put('/certificados/:id', async (req, res) => {
    try {
        const cert = await ApiBancariaCertificado.findByPk(req.params.id);
        if (!cert) return res.status(404).json({ error: 'Certificado não encontrado' });

        const { label, expiresOn } = req.body;
        await cert.update({ label, expiresOn });

        const updated = await ApiBancariaCertificado.findByPk(cert.id, { include: certificateInclude });
        res.json(serializeCertificate(updated));
    } catch (err) {
        console.error('[PUT /certificados/:id]', err);
        res.status(500).json({ error: 'Erro ao atualizar certificado' });
    }
});

router.delete('/certificados/:id', async (req, res) => {
    try {
        const deleted = await ApiBancariaCertificado.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Certificado não encontrado' });
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /certificados/:id]', err);
        res.status(500).json({ error: 'Erro ao remover certificado' });
    }
});

module.exports = router;
