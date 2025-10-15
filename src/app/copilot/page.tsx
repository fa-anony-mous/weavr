'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot, Send, Loader2, Workflow } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Only send sessionId when it's a non-empty string to satisfy API schema
          ...(sessionId ? { sessionId } : {}),
          message: userMessage.content,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_${Math.random()}`,
          role: 'assistant',
          content: result.data.message.content,
          timestamp: result.data.message.timestamp,
        };

        setMessages(prev => [...prev, assistantMessage]);
        setSessionId(result.data.sessionId);

        // If workflow was generated, show option to open builder
        if (result.data.generatedWorkflow) {
          const workflowMessage: Message = {
            id: `msg_${Date.now()}_workflow`,
            role: 'assistant',
            content: 'I\'ve generated a workflow for you! Would you like to open it in the builder?',
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, workflowMessage]);
        }
      } else {
        const error = await response.json();
        const errorMessage: Message = {
          id: `msg_${Date.now()}_error`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.error}`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openBuilder = () => {
    router.push('/builder');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-300 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex items-center justify-between py-6">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot className="h-7 w-7 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Copilot</h1>
              <p className="text-base text-gray-700">Let me help you build intelligent workflows</p>
            </div>
          </div>
          <Button onClick={openBuilder} variant="outline" size="lg" className="text-base">
            <Workflow className="h-5 w-5 mr-2" />
            Open Builder
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-[calc(100vh-120px)]">
        {/* Main Chat */}
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 my-6">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mb-6">
                  <Bot className="h-20 w-20 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Welcome to the AI Copilot!
                </h3>
                <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
                  I can help you design and build intelligent workflows. What would you like to automate?
                </p>
                <div className="space-y-3 max-w-xl mx-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setInput("I want to automate customer support ticket processing")}
                    className="w-full text-left justify-start text-base py-6"
                  >
                    <span className="text-blue-600 mr-3 text-xl">→</span>
                    Customer Support Automation
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setInput("I need a document processing workflow")}
                    className="w-full text-left justify-start text-base py-6"
                  >
                    <span className="text-green-600 mr-3 text-xl">→</span>
                    Document Processing Workflow
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setInput("Create a multi-agent research system")}
                    className="w-full text-left justify-start text-base py-6"
                  >
                    <span className="text-purple-600 mr-3 text-xl">→</span>
                    Multi-Agent Research System
                  </Button>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {message.role === 'assistant' && (
                        <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                          <Bot className="h-5 w-5 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-base leading-relaxed whitespace-pre-wrap break-words ${
                          message.role === 'user' ? 'text-white' : 'text-gray-900'
                        }`}>{message.content}</p>
                        <p className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <Bot className="h-5 w-5 text-blue-600" />
                    </div>
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="text-base text-gray-700 font-medium">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-6 bg-white">
            <div className="flex space-x-4">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe what you want to automate..."
                disabled={isLoading}
                className="flex-1 text-base py-6 px-4 border-2 focus:border-blue-500"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="lg"
                className="px-8"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
