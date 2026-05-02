import { useState, useRef, useEffect, useCallback } from 'react'
import './AIChatPanel.css'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-chat'

function buildSystemPrompt(patient, modelMeta, analyteMeta) {
  const abnormal = Object.entries(patient.biomarker_flags || {})
    .filter(([, f]) => f === 'high' || f === 'low')
    .map(([name, f]) => `${name}: ${f.toUpperCase()}`)
    .join(', ')

  const survTier = (() => {
    const t = modelMeta?.survival_thresholds
    if (!t) return 'unknown'
    if (patient.survival_prob >= t.high_threshold) return 'high'
    if (patient.survival_prob >= t.low_threshold) return 'moderate'
    return 'low'
  })()

  const recTier = (() => {
    const t = modelMeta?.recurrence_thresholds
    if (!t) return 'unknown'
    if (patient.recurrence_prob >= t.high_threshold) return 'high'
    if (patient.recurrence_prob >= t.low_threshold) return 'moderate'
    return 'low'
  })()

  const topSurvFactors = (patient.survival_factors || []).slice(0, 5)
    .map(f => `${f.label}: ${f.direction === 'increases_risk' ? '▲' : '▼'} (contribution: ${f.contribution})`)
    .join('; ')

  const topRecFactors = (patient.recurrence_factors || []).slice(0, 5)
    .map(f => `${f.label}: ${f.direction === 'increases_risk' ? '▲' : '▼'} (contribution: ${f.contribution})`)
    .join('; ')

  // Brain MRI specific results if available
  const mri = patient.mri_results
  const mriContext = mri ? `
## Brain MRI Analysis (NeuroBridge)
- Alzheimer Staging: ${mri.alzheimer?.finding || 'N/A'} (Confidence: ${Math.round(mri.alzheimer?.confidence * 100)}%)
- Tumor Classification: ${mri.tumor?.finding || 'N/A'} (Confidence: ${Math.round(mri.tumor?.confidence * 100)}%)
- Primary Observation: ${mri.primary_task || 'N/A'}
- Clinical Note: ${mri.clinical_note || 'N/A'}
` : ''

  return `You are a clinical decision support assistant for a Head & Neck Squamous Cell Carcinoma (HNSCC) tool.

## Current Patient Data
- Patient ID: ${patient.patient_id}
- Age: ${patient.age}, Sex: ${patient.sex}, Smoking: ${patient.smoking_status}
- Tumor site: ${patient.primary_tumor_site}, Stage: ${patient.pT_stage}/${patient.pN_stage}, Grade: ${patient.grading}
- HPV/p16: ${patient.hpv_association_p16}, Resection: ${patient.resection_status}
- Histologic type: ${patient.histologic_type}
- Perinodal invasion: ${patient.perinodal_invasion}, Lymphovascular invasion: ${patient.lymphovascular_invasion_L}
- Treatment: ${patient.first_treatment_modality} (${patient.first_treatment_intent})
- Survival status: ${patient.survival_status}
- Recurrence: ${patient.recurrence}${patient.days_to_recurrence ? ` (day ${patient.days_to_recurrence})` : ''}
- Metastasis: ${patient.metastasis_locations?.join(', ') || 'none recorded'}
${mriContext}

## Model Predictions
- Survival (mortality) probability: ${Math.round(patient.survival_prob * 100)}% → ${survTier} risk
- Recurrence probability: ${Math.round(patient.recurrence_prob * 100)}% → ${recTier} risk
- Blood data completeness: ${Math.round(patient.blood_completeness * 100)}%

## Top Survival Risk Factors
${topSurvFactors || 'Not available'}

## Top Recurrence Risk Factors
${topRecFactors || 'Not available'}

## Abnormal Biomarkers
${abnormal || 'None flagged'}

## Instructions
- Answer clinical questions about this patient concisely and clearly.
- Always clarify you are a decision support tool, not a replacement for clinical judgment.
- Never make definitive diagnoses. Use language like "the model suggests", "this may indicate", "clinically associated with".
- When explaining model predictions, reference the specific top factors.
- When asked about biomarkers, explain what elevated or low values mean in the HNSCC context.
- For "what if" questions, reason through the clinical logic but be explicit about uncertainty.
- Keep responses focused and structured. Use bullet points for lists.
- Always end responses that involve risk interpretation with a brief disclaimer.`
}

const SUGGESTED_QUESTIONS = [
  'Why is the recurrence risk estimated as high?',
  'What does elevated CRP mean for this patient?',
  'How does HPV status affect prognosis?',
  'Which factors have the most influence on survival?',
  'What would happen if the patient had lower stage disease?',
]

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">{isUser ? '👤' : '🤖'}</div>
      <div className="message-content">
        {msg.content.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i < msg.content.split('\n').length - 1 && <br />}
          </span>
        ))}
        {msg.streaming && <span className="cursor-blink" />}
      </div>
    </div>
  )
}

export default function AIChatPanel({ patient, modelMeta, analyteMeta }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const abortRef = useRef(null)

  const apiKey = localStorage.getItem('deepseek_api_key') || ''
  const hasAnalysis = !!patient.mri_results

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset messages when patient changes
  useEffect(() => {
    setMessages([])
    setApiError(null)
  }, [patient.patient_id])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading || !hasAnalysis) return

    const userMsg = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setApiError(null)

    if (!apiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'No API key found. Please open Settings (⚙ top right) and enter your DeepSeek API key to enable AI responses.',
      }])
      setIsLoading(false)
      return
    }

    const systemPrompt = buildSystemPrompt(patient, modelMeta, analyteMeta)
    const history = messages
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: m.content }))

    const body = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: text.trim() },
      ],
      stream: true,
      max_tokens: 800,
      temperature: 0.3,
    }

    const placeholderId = Date.now()
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, id: placeholderId }])

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`API error ${response.status}: ${errText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.trim())

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              accumulated += delta
              const acc = accumulated
              setMessages(prev =>
                prev.map(m =>
                  m.streaming && m.id === placeholderId
                    ? { ...m, content: acc }
                    : m
                )
              )
            }
          } catch (_) { /* skip malformed chunks */ }
        }
      }

      // Finalize
      setMessages(prev =>
        prev.map(m =>
          m.streaming && m.id === placeholderId
            ? { ...m, streaming: false }
            : m
        )
      )
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.streaming ? { ...m, content: m.content + ' [stopped]', streaming: false } : m
          )
        )
      } else {
        setMessages(prev => prev.filter(m => !(m.streaming && m.id === placeholderId)))
        setApiError(err.message)
      }
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [patient, modelMeta, analyteMeta, messages, isLoading, apiKey, hasAnalysis])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function stopGeneration() {
    abortRef.current?.abort()
  }

  if (!hasAnalysis) {
    return (
      <div className="chat-panel disabled">
        <div className="chat-panel-header">
          <div className="chat-panel-title">AI Assistant</div>
        </div>
        <div className="chat-messages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="chat-welcome" style={{ maxWidth: '400px' }}>
            <div className="welcome-icon">🧠</div>
            <h3>Analysis Required</h3>
            <p>The AI Assistant requires brain MRI analysis results to provide clinical context.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              Please go to the <strong>Overview</strong> tab, upload a brain MRI scan, and click <strong>"Analyse"</strong> to begin.
            </p>
          </div>
        </div>
        <div className="chat-input-area" style={{ opacity: 0.5, pointerEvents: 'none' }}>
          <textarea className="chat-input" placeholder="Analysis required to ask questions…" disabled rows={2} />
        </div>
      </div>
    )
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel-header">
        <div>
          <div className="chat-panel-title">AI Assistant</div>
          <div className="chat-panel-sub">Powered by DeepSeek · Patient #{patient.patient_id}</div>
        </div>
        {!apiKey && (
          <span className="badge badge-incomplete">⚠ No API key</span>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="welcome-icon">🔬</div>
            <h3>Ask about Patient #{patient.patient_id}</h3>
            <p>Ask clinical questions about risk factors, biomarkers, or treatment context.</p>
            <div className="suggested-questions">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  className="suggested-q"
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {apiError && (
          <div className="chat-error">
            <strong>Error:</strong> {apiError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="Ask a clinical question… (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isLoading && !abortRef.current}
        />
        <div className="chat-input-actions">
          {isLoading ? (
            <button className="btn btn-ghost btn-sm" onClick={stopGeneration}>■ Stop</button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
            >
              Send ↵
            </button>
          )}
        </div>
      </div>

      <p className="chat-disclaimer">
        This AI assistant provides educational decision support only. It is not a substitute for clinical
        judgment and must not be used for actual patient care decisions.
      </p>
    </div>
  )
}
