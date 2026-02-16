import { ReactNode } from 'react'
import { Activity, TrendingUp, Bot, DollarSign } from 'lucide-react'
import { useBotStatus } from '../hooks/useApi'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { data: status } = useBotStatus()
  
  const currentPrice = 69420 // Mock BTC price - replace with real data

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/20 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/20">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Bot className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Trading Bot Dashboard</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-6 text-sm">
            {/* Bot Status */}
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${
                status?.status === 'running' ? 'bg-success' :
                status?.status === 'paper' ? 'bg-yellow-500' :
                'bg-destructive'
              }`} />
              <span className="text-muted-foreground">
                {status?.status === 'running' ? '🟢 Live' :
                 status?.status === 'paper' ? '🟡 Paper' :
                 '🔴 Stopped'}
              </span>
            </div>
            
            {/* BTC Price */}
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-muted-foreground">BTC</span>
              <span className="font-mono">${currentPrice.toLocaleString()}</span>
            </div>
            
            {/* Balance */}
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Balance</span>
              <span className="font-mono">${status?.balance.toLocaleString() || '0'}</span>
            </div>
            
            {/* Last Updated */}
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {status?.lastUpdated ? new Date(status.lastUpdated).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  )
}