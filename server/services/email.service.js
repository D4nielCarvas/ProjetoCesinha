const nodemailer = require('nodemailer');

const APP_NAME = 'Poma - Projetos em Inteligência Agrícola';
const APP_URL  = process.env.APP_URL || 'http://localhost:3000';

/**
 * Cria e retorna um transporter Nodemailer configurado via variáveis de ambiente.
 * Suporta qualquer provedor SMTP (Gmail, Outlook, Resend SMTP, etc.).
 *
 * Variáveis:
 *   SMTP_HOST   - ex: smtp.gmail.com
 *   SMTP_PORT   - ex: 587 (padrão)
 *   SMTP_SECURE - "true" para porta 465, caso contrário usa STARTTLS
 *   SMTP_USER   - endereço de e-mail remetente
 *   SMTP_PASS   - senha de app ou token
 */
function createTransporter() {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
}

/**
 * Envia o e-mail de recuperação de senha.
 * Se o SMTP não estiver configurado, loga o link no console para uso em desenvolvimento.
 *
 * @param {string} toEmail  - Endereço do destinatário
 * @param {string} toName   - Nome do destinatário
 * @param {string} token    - Token seguro de recuperação
 */
async function sendPasswordResetEmail(toEmail, toName, token) {
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    const transporter = createTransporter();

    if (!transporter) {
        // Fallback de desenvolvimento: exibe o link no console
        console.log('\n========================================================');
        console.log('[Email Service] SMTP não configurado. Link de recuperação:');
        console.log(`  Para: ${toEmail}`);
        console.log(`  Link: ${resetUrl}`);
        console.log('========================================================\n');
        return { preview: resetUrl };
    }

    const html = buildResetEmailHtml(toName, resetUrl);

    const info = await transporter.sendMail({
        from: `"${APP_NAME}" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `[${APP_NAME}] Redefinição de Senha`,
        html
    });

    console.log(`[Email Service] E-mail de redefinição enviado para ${toEmail}. MessageId: ${info.messageId}`);
    return { messageId: info.messageId };
}

function buildResetEmailHtml(name, resetUrl) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinição de Senha - ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;background:linear-gradient(135deg,#1e40af,#7c3aed);">
              <div style="display:inline-block;background:rgba(255,255,255,.15);border-radius:12px;padding:10px 14px;margin-bottom:12px;">
                <span style="font-size:24px;">🔐</span>
              </div>
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px;">Redefinição de senha</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">Olá, <strong style="color:#e2e8f0;">${name}</strong></p>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta.
                Clique no botão abaixo para criar uma nova senha:
              </p>
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${resetUrl}"
                   style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:.3px;">
                  Redefinir Minha Senha
                </a>
              </div>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">
                Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanecerá inalterada.
              </p>
              <p style="margin:0;color:#64748b;font-size:12px;">
                ⏰ Este link expira em <strong>1 hora</strong>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                © ${new Date().getFullYear()} ${APP_NAME} · Gestão Científica de Projetos
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { sendPasswordResetEmail };
