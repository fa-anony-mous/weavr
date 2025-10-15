'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Workflow, Monitor, Zap, GitBranch, Users, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Agentic Orchestration Builder
          </h1>
          <p className="mt-6 text-xl leading-8 text-gray-700 max-w-3xl mx-auto">
            Build intelligent workflows with AI agents, human approvals, and visual design. 
            Create complex automation that adapts and learns from your business processes.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/copilot">
              <Button size="lg" className="text-lg px-8 py-6">
                <Bot className="mr-2 h-5 w-5" />
                Start with AI Copilot
              </Button>
            </Link>
            <Link href="/builder">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                <Workflow className="mr-2 h-5 w-5" />
                Open Builder
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-2 hover:border-blue-500 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Workflow className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Visual Workflow Builder</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-gray-700">
                Drag-and-drop interface with 7+ node types. Design complex workflows visually with triggers, actions, agents, approvals, and more.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Bot className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">AI-Powered Agents</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-gray-700">
                Integrate Groq LLM for intelligent decision-making. Dynamic agent spawning and multi-agent orchestration capabilities.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-purple-500 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Monitor className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Real-time Monitoring</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-gray-700">
                Track workflow execution in real-time. View step-by-step progress, outputs, and handle approvals seamlessly.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-orange-500 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Zap className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle className="text-xl">Event-Driven Execution</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-gray-700">
                Trigger workflows via webhooks, manual starts, or schedules. Support for conditional branching and parallel execution.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-pink-500 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Users className="h-6 w-6 text-pink-600" />
                </div>
                <CardTitle className="text-xl">Human-in-the-Loop</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-gray-700">
                Pause workflows for human approval. Resume execution with approval data and maintain full control over critical decisions.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-indigo-500 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <GitBranch className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle className="text-xl">Advanced Orchestration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-gray-700">
                Support for DAGs, cyclic graphs, loops, and dynamic agent spawning. Build sophisticated multi-agent systems with ease.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="mt-24">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-700">
              Get started in three simple steps
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="relative">
              <div className="flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white text-2xl font-bold">
                  1
                </div>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-center text-gray-900">
                Describe Your Process
              </h3>
              <p className="mt-2 text-base text-gray-700 text-center">
                Tell our AI Copilot what you want to automate. It'll ask guided questions to understand your requirements.
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white text-2xl font-bold">
                  2
                </div>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-center text-gray-900">
                Generate & Refine
              </h3>
              <p className="mt-2 text-base text-gray-700 text-center">
                Our AI generates a visual workflow with the right nodes and connections. Refine it until it's perfect.
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-white text-2xl font-bold">
                  3
                </div>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-center text-gray-900">
                Execute & Monitor
              </h3>
              <p className="mt-2 text-base text-gray-700 text-center">
                Run your workflow and monitor execution in real-time. Handle approvals and track every step.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-12 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to build intelligent workflows?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            No account required • Start building immediately
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/copilot">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                <Bot className="mr-2 h-5 w-5" />
                AI Copilot
              </Button>
            </Link>
            <Link href="/builder">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 bg-white hover:bg-gray-100 text-gray-900">
                <Workflow className="mr-2 h-5 w-5" />
                Workflow Builder
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
