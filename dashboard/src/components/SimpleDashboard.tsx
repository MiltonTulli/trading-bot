import { useState } from 'react'
import { BotControls } from './BotControls'
import { EventFeed } from './EventFeed'
import { TradeHistory } from './TradeHistory'
import { BacktestRunner } from './BacktestRunner'
import { StatusBar } from './StatusBar'

export function SimpleDashboard() {
  const [activeTab, setActiveTab] = useState<'trading' | 'backtest'>('trading')

  return (
    <div className="min-h-screen bg-background text-foreground p-4 space-y-4">
      {/* Status Bar */}
      <StatusBar />
      
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-secondary/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('trading')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'trading' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Live Trading
        </button>
        <button
          onClick={() => setActiveTab('backtest')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'backtest' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Backtest
        </button>
      </div>

      {activeTab === 'trading' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Controls */}
          <div className="space-y-4">
            <BotControls />
          </div>
          
          {/* Middle Column: Event Feed */}
          <div className="lg:col-span-1">
            <EventFeed />
          </div>
          
          {/* Right Column: Trade History */}
          <div className="lg:col-span-1">
            <TradeHistory />
          </div>
        </div>
      ) : (
        <BacktestRunner />
      )}
    </div>
  )
}