import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";

const app = express();
const PORT = 3000;

// Parse JSON body
app.use(express.json());

// Initialize Gemini SDK client on the server side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API route for real SMTP check and send
app.post("/api/send-email", async (req, res) => {
  try {
    const { smtpConfig, to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing recipient, subject, or body" });
    }

    // Check if smtpConfig is provided and has a host or is gmail
    const hasSmtp = smtpConfig && (smtpConfig.host || smtpConfig.smtp_type === "gmail");

    if (!hasSmtp) {
      // Fallback: No SMTP configured, simulate sending successfully!
      console.log(`[SMTP SIMULADO] Envio de e-mail para: ${to}`);
      console.log(`Assunto: ${subject}`);
      console.log(`Corpo:\n${body}`);
      return res.json({
        success: true,
        simulated: true,
        message: "E-mail simulado com sucesso! (Nenhum servidor SMTP configurado)."
      });
    }

    const isGmail = smtpConfig.smtp_type === "gmail" || (smtpConfig.host && smtpConfig.host.toLowerCase().includes("gmail"));

    // If it's Gmail or a server that requires authentication, but credentials are missing or blank, throw immediately to fallback
    if (isGmail && (!smtpConfig.user || !smtpConfig.pass || smtpConfig.user.trim() === "" || smtpConfig.pass.trim() === "")) {
      throw new Error("Gmail SMTP requires valid username and password/app-password. Falling back to simulation.");
    }

    let transporter;

    if (isGmail) {
      // Use standard Gmail SMTP service
      const transportOptions: any = {
        service: "gmail",
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
        connectionTimeout: 5000,
      };
      transporter = nodemailer.createTransport(transportOptions);
    } else {
      // Use custom SMTP
      const transportOptions: any = {
        host: smtpConfig.host,
        port: Number(smtpConfig.port) || 587,
        secure: smtpConfig.secure === true || Number(smtpConfig.port) === 465,
        tls: {
          rejectUnauthorized: false, // Prevents certificate verification issues on private/custom servers
        },
        connectionTimeout: 5000, // 5s timeout to keep it fast
      };

      // CRITICAL: Avoid "Missing credentials for PLAIN" when user/pass are not provided or are empty strings
      if (smtpConfig.user && smtpConfig.pass && smtpConfig.user.trim() !== "" && smtpConfig.pass.trim() !== "") {
        transportOptions.auth = {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        };
      }

      transporter = nodemailer.createTransport(transportOptions);
    }

    // Try to verify and send real SMTP email
    try {
      await transporter.verify();
      
      // For Gmail SMTP, the 'from' email MUST match the authenticated user, or Gmail will reject it with 530 Authentication Required.
      // We set replyTo to the desired sender_email so reply-flow remains correct.
      const fromEmail = isGmail ? smtpConfig.user : (smtpConfig.sender_email || smtpConfig.user || "no-reply@saas-educacional.com");
      const fromName = smtpConfig.sender_name || 'SaaS';

      const mailOptions: any = {
        from: `"${fromName}" <${fromEmail}>`,
        to: to,
        subject: subject,
        text: body,
      };

      if (isGmail && smtpConfig.sender_email && smtpConfig.sender_email !== smtpConfig.user) {
        mailOptions.replyTo = smtpConfig.sender_email;
      }

      await transporter.sendMail(mailOptions);
      console.log(`[SMTP REAL] E-mail enviado com sucesso para ${to}`);
      return res.json({ success: true, message: "E-mail real enviado com sucesso!" });
    } catch (smtpError: any) {
      console.warn("SMTP send failed, falling back to simulation:", smtpError.message || smtpError);
      // Fallback: real SMTP failed, simulate sending successfully so the user is not blocked!
      return res.json({
        success: true,
        simulated: true,
        warning: smtpError.message || "Erro na conexão SMTP",
        message: "E-mail simulado devido a erro de conexão SMTP."
      });
    }
  } catch (error: any) {
    console.error("Error in /api/send-email:", error);
    // Even if there's a fatal error in the function, fall back to simulation to keep the UI running
    return res.json({
      success: true,
      simulated: true,
      message: "E-mail simulado devido a falha crítica no envio."
    });
  }
});

// 1. API route for background AI Translation
app.post("/api/translate", async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: "Text and targetLanguage are required." });
    }

    if (!ai) {
      return res.status(503).json({
        error: "Servidor sem chave de API do Gemini configurada.",
        fallback: true
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an expert real-time translator for a high-performance educational SaaS platform.
Translate the following text into ${targetLanguage}.
Keep all variable placeholders like \${name}, \${role}, HTML elements, braces, and emojis exactly as they are.
Respond ONLY with the translated text, with no preamble, no markdown codeblocks, and no trailing notes.
Text to translate: "${text}"`,
    });

    const translatedText = response.text ? response.text.trim() : text;
    res.json({ translatedText });
  } catch (error: any) {
    console.error("Error with Gemini translation API:", error);
    res.status(500).json({ error: error.message || "Failed to translate text" });
  }
});

// API route for book synopsis generation based on PDF upload or book meta
app.post("/api/biblioteca/generate-synopsis", async (req, res) => {
  const { title, author, category, textSample, fileName } = req.body;
  try {
    if (!ai) {
      // Simulate synopsis if Gemini is not initialized or configured
      const simulatedSynopsis = `Sinopse de Simulação para "${title || fileName || "Livro Desconhecido"}":\n\nEste livro oferece uma visão aprofundada sobre temas relevantes de ${category || "Geral"}. Escrita por ${author || "Autor Desconhecido"}, a obra explora conceitos fundamentais com rigor acadêmico e clareza pedagógica, ideal para estudantes e docentes de toda a instituição.`;
      return res.json({ synopsis: simulatedSynopsis, simulated: true });
    }

    const prompt = `You are a professional literary critic and educational SaaS assistant.
Generate an engaging, educational, and elegant book synopsis in Portuguese for the following book.
- Book Title: ${title || "Unknown"}
- Author: ${author || "Unknown"}
- Category: ${category || "General"}
- File Name: ${fileName || ""}
- Raw Text Sample extracted from PDF: "${textSample ? textSample.slice(0, 1000) : "No text sample available"}"

Your response must contain ONLY the generated synopsis in Portuguese. No introductory text, no markdown styling like bold or bullet points unless necessary for paragraphs, no "Aqui está a sinopse", and no extra commentary. Keep it concise, professional, and directly editable by a user. Max 2-3 paragraphs.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const generatedSynopsis = response.text ? response.text.trim() : "";
    res.json({ synopsis: generatedSynopsis });
  } catch (error: any) {
    console.error("Error generating synopsis with Gemini:", error);
    // Graceful fallback on error
    const fallbackSynopsis = `Sinopse de Recuperação para "${title || fileName || "Livro Desconhecido"}":\n\nUma obra fundamental na categoria de ${category || "Geral"}. Este volume, de autoria de ${author || "Autor Desconhecido"}, reúne conceitos estruturantes e práticas pedagógicas desenvolvidas para complementar o currículo letivo com dinamismo e qualidade científica.`;
    res.json({ synopsis: fallbackSynopsis, error: error.message || "Failed to generate synopsis" });
  }
});

// Vite middleware setup
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
