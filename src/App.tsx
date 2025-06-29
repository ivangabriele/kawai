import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { CornerDownLeft, Search, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { tomorrowNight } from 'react-syntax-highlighter/dist/esm/styles/hljs'

const DEBOUNCE_DELAY = 500
const SYSTEM_PROMPT = `
You are kawAI 🐰, an AI assistant integrated into a desktop command palette.
Your primary goal is to provide extremely concise, direct, and immediate answers to a developer's query.
- If the user asks for a command or syntax, provide only that.
- Be brief. No extra chatter, greetings, or explanations unless explicitly asked.
- Assume the user is a technical expert who needs a quick reminder, not a tutorial.
- Example Query: "python sort array"
- Example Response: "list.sort() or sorted()"
`

/**
 * Main application component for the kawAI command palette.
 */
export default function App() {
  const [apiKey, setApiKey] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounceTimeoutRef = useRef<number | null>(null)

  const fetchAnswer = useCallback(
    async (currentQuery: string) => {
      if (!apiKey) {
        setError('API key is not set. Please check your configuration.')
        setIsLoading(false)

        return
      }

      if (!currentQuery || currentQuery.trim().length < 3) {
        setAnswer('')
        setIsLoading(false)

        return
      }

      setIsLoading(true)
      setError(null)

      const fullPrompt = `${SYSTEM_PROMPT}\n\nUser Query: "${currentQuery}"`

      const chatHistory = [{ role: 'user', parts: [{ text: fullPrompt }] }]
      const payload = { contents: chatHistory }
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`)
        }

        const result = await response.json()

        if (
          result.candidates &&
          result.candidates.length > 0 &&
          result.candidates[0].content &&
          result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0
        ) {
          const text = result.candidates[0].content.parts[0].text
          setAnswer(text)
        } else {
          setAnswer("Sorry, I couldn't get a clear answer.")
        }
      } catch (err) {
        console.error('Failed to fetch from Gemini API:', err)
        setError('Failed to get an answer. Please check the console.')
        setAnswer('')
      } finally {
        setIsLoading(false)
      }
    },
    [apiKey],
  )

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    if (query.trim() && query.trim().length >= 12) {
      setIsLoading(true)

      debounceTimeoutRef.current = setTimeout(() => {
        fetchAnswer(query)
      }, DEBOUNCE_DELAY)
    } else {
      setIsLoading(false)
      setAnswer('')
      setError(null)
    }

    // Cleanup on unmount or if query changes
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [query, fetchAnswer])

  useEffect(() => {
    const unlisten = listen('CLEAR_AND_FOCUS', () => {
      console.log('Clearing input and focusing...')

      if (!inputRef.current) {
        throw new Error('`inputRef.current` is null.')
      }

      if (inputRef.current.value) {
        setAnswer('')
      }

      inputRef.current.focus()
    })

    return () => {
      unlisten.then(unsub => unsub())
    }
  }, [])

  const retrieveApiKey = useCallback(async () => {
    try {
      const key = await invoke<string>('get_api_key')
      setApiKey(key)
    } catch (err) {
      console.error('Failed to retrieve API key:', err)
      setError('Failed to retrieve API key. Please check the console.')
    }
  }, [])

  useEffect(() => {
    retrieveApiKey()
  }, [retrieveApiKey])

  const hideWindow = useCallback(async () => {
    try {
      await invoke('hide_window')
    } catch (err) {
      console.error('Failed to hide window:', err)
      setError('Failed to hide window. Please check the console.')
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('Escape key pressed, hiding command palette...')
        hideWindow()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hideWindow])

  return (
    <div className="flex flex-col h-full w-full bg-[#313244] rounded-xl shadow-2xl border border-[#45475a] overflow-hidden">
      <div className="flex items-center p-4 border-b border-[#45475a]">
        <Search className="w-5 h-5 text-[#89b4fa] mr-3" />
        <input
          ref={inputRef}
          // biome-ignore lint/a11y/noAutofocus: This is a command palette, so it should focus automatically.
          autoFocus
          className="w-full bg-transparent text-lg text-white placeholder:text-[#6c7086] focus:outline-none"
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask kawAI anything..."
          type="text"
          value={query}
        />
      </div>

      {/* Output Section */}
      <div className="p-6 justify-center grow overflow-y-auto">
        {isLoading && !answer && (
          <div className="flex items-center text-[#9399b2] animate-pulse">
            <Zap className="w-5 h-5 mr-3 animate-ping" />
            <span>Thinking...</span>
          </div>
        )}
        {error && <p className="text-[#f38ba8]">{error}</p>}

        {answer && (
          <div className="Answer">
            <Markdown
              // biome-ignore lint/correctness/noChildrenProp: False positive.
              children={answer}
              components={{
                code(props) {
                  const { children, className, node: _node, ...rest } = props
                  const match = /language-(\w+)/.exec(className || '')
                  return match ? (
                    // @ts-ignore
                    <SyntaxHighlighter
                      {...rest}
                      PreTag="div"
                      // biome-ignore lint/correctness/noChildrenProp: False positive.
                      children={String(children).replace(/\n$/, '')}
                      language={match[1]}
                      style={tomorrowNight}
                    />
                  ) : (
                    <code {...rest} className={className}>
                      {children}
                    </code>
                  )
                },
              }}
            />
          </div>
        )}

        {!isLoading && !answer && !error && (
          <div className="text-[#6c7086] text-center">
            <p>Your instant answer will appear here.</p>
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div className="bg-[#181825] text-xs text-[#6c7086] px-4 py-2 flex justify-end items-center">
        <span>Press</span>
        <CornerDownLeft className="w-3 h-3 mx-1.5" />
        <span>to submit</span>
      </div>
    </div>
  )
}
