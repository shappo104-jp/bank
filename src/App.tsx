import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { ChevronLeft, ChevronRight, ChevronDown, HelpCircle, Bell, LogOut, Home, Building2, ArrowLeftRight, Settings, User, Search, X, Plus } from 'lucide-react'

type Screen = 'home' | 'meisai' | 'date'

interface Transaction {
  id: number
  date: string
  month: number
  day: number
  type: string
  description: string
  amount: number
}

const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl === undefined) return 'http://localhost:8000'
  if (envUrl === '') return window.location.origin
  return envUrl
}
const API_URL = getApiUrl()

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: 1, date: '1/05', month: 1, day: 5, type: '電話', description: 'ドコモケイタイ', amount: -6692 },
  { id: 2, date: '12/29', month: 12, day: 29, type: 'カード', description: '', amount: -434000 },
  { id: 3, date: '12/25', month: 12, day: 25, type: '振込2', description: 'カ）エヌイーエフコミュニケーシ', amount: 442507 },
  { id: 4, date: '12/01', month: 12, day: 1, type: '電話', description: 'ドコモケイタイ', amount: -6883 },
  { id: 5, date: '11/28', month: 11, day: 28, type: 'カード', description: '', amount: -216000 },
  { id: 6, date: '11/27', month: 11, day: 27, type: '振込2', description: 'カ）エヌイーエフコミュニケーシ', amount: 231338 },
  { id: 7, date: '10/31', month: 10, day: 31, type: '電話', description: 'ドコモケイタイ', amount: -6863 },
  { id: 8, date: '10/30', month: 10, day: 30, type: 'カード', description: '', amount: -183000 },
  { id: 9, date: '10/30', month: 10, day: 30, type: '振込2', description: 'カ）エヌイーエフコミュニケーシ', amount: 189129 },
]

const BASE_BALANCE = 448772

const STORAGE_KEY = 'bank_transactions'

const loadLocalTransactions = (): Transaction[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
  }
  return DEFAULT_TRANSACTIONS
}

const saveLocalTransactions = (txList: Transaction[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txList))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

const calcBalance = (txList: Transaction[]): number => {
  const adjustment = txList.reduce((sum, tx) => {
    if (tx.month === 1 || tx.month === 2 || (tx.month === 12 && tx.day >= 29)) {
      return sum + tx.amount
    }
    return sum
  }, 0)
  return BASE_BALANCE + adjustment
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [showBalanceAfter, setShowBalanceAfter] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null)
  const [customStartDate, setCustomStartDate] = useState(() => {
    const now = new Date()
    const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    const startDate = new Date(japanTime)
    startDate.setMonth(startDate.getMonth() - 1)
    return `${startDate.getFullYear()}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getDate().toString().padStart(2, '0')}`
  })
  const [customEndDate, setCustomEndDate] = useState(() => {
    const now = new Date()
    const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    return `${japanTime.getFullYear()}/${(japanTime.getMonth() + 1).toString().padStart(2, '0')}/${japanTime.getDate().toString().padStart(2, '0')}`
  })
  const [newTransaction, setNewTransaction] = useState({
    month: 12,
    day: 1,
    type: '振込',
    description: '',
    amount: 0,
    isExpense: false
  })
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [currentBalance, setCurrentBalance] = useState<number>(0)
  
  const [swipedItemId, setSwipedItemId] = useState<number | null>(null)
  const [touchStartX, setTouchStartX] = useState<number>(0)
  
  const getTypePriority = (type: string): number => {
    if (type === '電話') return 0
    if (type === 'カード') return 1
    if (type === '振込2' || type === '振込') return 2
    return 3
  }
  
  const getTransactionDate = (tx: Transaction): Date => {
    const now = new Date()
    const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    const currentYear = japanTime.getFullYear()
    const currentMonth = japanTime.getMonth() + 1
    
    let txYear = currentYear
    if (tx.month > currentMonth + 1) {
      txYear = currentYear - 1
    }
    return new Date(txYear, tx.month - 1, tx.day)
  }

  const sortTransactions = (txList: Transaction[]): Transaction[] => {
    return [...txList].sort((a, b) => {
      const dateA = getTransactionDate(a).getTime()
      const dateB = getTransactionDate(b).getTime()
      if (dateA !== dateB) return dateB - dateA
      return getTypePriority(a.type) - getTypePriority(b.type)
    })
  }

  const [useLocalStorage, setUseLocalStorage] = useState(false)

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/transactions`)
      if (response.ok) {
        const data = await response.json()
        setTransactions(sortTransactions(data))
        return
      }
    } catch (error) {
      console.error('Failed to fetch transactions, using localStorage:', error)
    }
    setUseLocalStorage(true)
    const localTx = loadLocalTransactions()
    setTransactions(sortTransactions(localTx))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchBalance = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/balance`)
      if (response.ok) {
        const data = await response.json()
        setCurrentBalance(data.balance)
        return
      }
    } catch (error) {
      console.error('Failed to fetch balance, using localStorage:', error)
    }
    const localTx = loadLocalTransactions()
    setCurrentBalance(calcBalance(localTx))
  }, [])

  const fetchData = useCallback(async () => {
    await Promise.all([fetchTransactions(), fetchBalance()])
  }, [fetchTransactions, fetchBalance])

  const accountInfo = {
    branchName: '柳橋支店',
    branchCode: '224',
    accountNumber: '0392891',
    accountType: '普通',
    balance: currentBalance
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      const month = japanTime.getMonth() + 1
      const day = japanTime.getDate()
      const hours = japanTime.getHours().toString().padStart(2, '0')
      const minutes = japanTime.getMinutes().toString().padStart(2, '0')
      setCurrentTime(`${month}/${day} ${hours}:${minutes}`)
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const getDateRange = () => {
    if (selectedPeriod === 'all') {
      return '全期間'
    }
    if (selectedPeriod === 'custom') {
      return `${customStartDate} - ${customEndDate}`
    }
    
    const now = new Date()
    const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    const endDate = new Date(japanTime)
    const startDate = new Date(japanTime)
    
    if (selectedPeriod === '30days') {
      startDate.setDate(startDate.getDate() - 30)
    } else if (selectedPeriod === 'thisMonth') {
      startDate.setDate(1)
    } else if (selectedPeriod === 'lastMonth') {
      startDate.setMonth(startDate.getMonth() - 1)
      startDate.setDate(1)
      endDate.setDate(0)
    } else {
      startDate.setMonth(startDate.getMonth() - 1)
    }
    
    const formatDate = (d: Date) => {
      return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
    }
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }

  const getTxDate = (tx: Transaction) => {
    return getTransactionDate(tx)
  }

  const getFilteredTransactions = () => {
    if (selectedPeriod === 'all') {
      return transactions.filter(tx => {
        if (selectedType === 'all') return true
        if (selectedType === 'deposit') return tx.amount > 0
        if (selectedType === 'withdraw') return tx.amount < 0
        return true
      })
    }

    const now = new Date()
    const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    let endDate: Date
    let startDate: Date
    
    if (selectedPeriod === 'custom') {
      const startParts = customStartDate.split('/')
      const endParts = customEndDate.split('/')
      startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]))
      endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]))
    } else {
      endDate = new Date(japanTime)
      startDate = new Date(japanTime)
      
      if (selectedPeriod === '30days') {
        startDate.setDate(startDate.getDate() - 30)
      } else if (selectedPeriod === 'thisMonth') {
        startDate.setDate(1)
      } else if (selectedPeriod === 'lastMonth') {
        startDate.setMonth(startDate.getMonth() - 1)
        startDate.setDate(1)
        endDate.setDate(0)
      } else {
        startDate.setMonth(startDate.getMonth() - 1)
      }
    }

    return transactions.filter(tx => {
      const txDate = getTxDate(tx)
      const inDateRange = txDate >= startDate && txDate <= endDate
      
      if (selectedType === 'all') return inDateRange
      if (selectedType === 'deposit') return inDateRange && tx.amount > 0
      if (selectedType === 'withdraw') return inDateRange && tx.amount < 0
      return inDateRange
    })
  }

  const getTypeLabel = () => {
    if (selectedType === 'all') return '全取引'
    if (selectedType === 'deposit') return '入金'
    return '出金'
  }

  const formatAmount = (amount: number) => {
    const absAmount = Math.abs(amount)
    const formatted = absAmount.toLocaleString()
    if (amount < 0) {
      return `-${formatted}`
    }
    return formatted
  }

  const addTransaction = async () => {
    const amount = newTransaction.isExpense ? -Math.abs(newTransaction.amount) : Math.abs(newTransaction.amount)
    const newTx = {
      date: `${newTransaction.month}/${newTransaction.day.toString().padStart(2, '0')}`,
      month: newTransaction.month,
      day: newTransaction.day,
      type: newTransaction.type,
      description: newTransaction.description,
      amount: amount
    }
    
    if (!useLocalStorage) {
      try {
        const response = await fetch(`${API_URL}/api/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newTx),
        })
        
        if (response.ok) {
          await fetchData()
          setShowAddTransaction(false)
          setNewTransaction({
            month: 12,
            day: 1,
            type: '振込',
            description: '',
            amount: 0,
            isExpense: false
          })
          return
        }
      } catch (error) {
        console.error('Failed to add transaction via API, using localStorage:', error)
      }
    }
    
    const localTx = loadLocalTransactions()
    const maxId = localTx.reduce((max, tx) => Math.max(max, tx.id), 0)
    const fullTx: Transaction = { ...newTx, id: maxId + 1 }
    const updatedTx = [...localTx, fullTx]
    saveLocalTransactions(updatedTx)
    setTransactions(sortTransactions(updatedTx))
    setCurrentBalance(calcBalance(updatedTx))
    setShowAddTransaction(false)
    setNewTransaction({
      month: 12,
      day: 1,
      type: '振込',
      description: '',
      amount: 0,
      isExpense: false
    })
  }

  const deleteTransaction = async (id: number) => {
    if (!useLocalStorage) {
      try {
        const response = await fetch(`${API_URL}/api/transactions/${id}`, {
          method: 'DELETE',
        })
        
        if (response.ok) {
          await fetchData()
          setDeleteConfirm(null)
          setSwipedItemId(null)
          return
        }
      } catch (error) {
        console.error('Failed to delete transaction via API, using localStorage:', error)
      }
    }
    
    const localTx = loadLocalTransactions()
    const updatedTx = localTx.filter(tx => tx.id !== id)
    saveLocalTransactions(updatedTx)
    setTransactions(sortTransactions(updatedTx))
    setCurrentBalance(calcBalance(updatedTx))
    setDeleteConfirm(null)
    setSwipedItemId(null)
  }

  const handleContextMenu = (e: React.MouseEvent, tx: Transaction) => {
    e.preventDefault()
    setDeleteConfirm(tx)
  }

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleSwipeTouchMove = (e: React.TouchEvent, txId: number) => {
    const touchCurrentX = e.touches[0].clientX
    const diff = touchCurrentX - touchStartX
    if (diff > 50) {
      setSwipedItemId(txId)
    } else if (diff < -50) {
      setSwipedItemId(null)
    }
  }

  const handleSwipeTouchEnd = () => {
  }

  const HomeScreen = () => (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="text-sm font-medium text-gray-700">MUFG</span>
          <span className="text-sm text-gray-600">三菱UFJ銀行</span>
        </div>
        <div className="flex items-center gap-4">
          <Bell className="w-5 h-5 text-red-500" />
          <HelpCircle className="w-5 h-5 text-red-500" />
          <LogOut className="w-5 h-5 text-red-500" />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700">普通預金</span>
            <button 
              onClick={() => setCurrentScreen('meisai')}
              className="text-sm text-gray-600 flex items-center"
            >
              明細を見る <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-gray-500 mb-2">
            {accountInfo.branchName} ({accountInfo.branchCode}) : {accountInfo.accountNumber}
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline">
              <span className="text-4xl font-bold">{accountInfo.balance.toLocaleString()}</span>
              <span className="text-lg ml-1">円</span>
            </div>
            <div className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center">
              <span className="text-gray-400 text-xs">●</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-lg">¥</span>
            </div>
            <span className="text-sm">振込・振替</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-lg">
            <div className="w-6 h-6 flex items-center justify-center text-gray-600">
              <span className="text-xs font-bold">Pay</span>
            </div>
            <div className="text-left">
              <div className="text-xs text-gray-500">ペイジー</div>
              <div className="text-xs text-gray-500">税金・各種払込</div>
            </div>
          </button>
        </div>

        <div className="px-4 space-y-3">
          <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center">
                <span className="text-xs text-gray-500">-</span>
              </div>
              <div>
                <div className="text-sm font-medium">三菱UFJカード</div>
                <div className="text-xs text-gray-500">おトクで便利なクレジットカード</div>
                <div className="text-xs text-gray-500">申し込みも明細確認もカンタンに</div>
              </div>
            </div>
            <div className="w-16 h-10 bg-red-500 rounded-lg flex items-center justify-center relative">
              <span className="text-white text-sm font-bold">P</span>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">$</span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center">
                <span className="text-xs text-red-500">/</span>
              </div>
              <div>
                <div className="text-sm font-medium">投資信託（NISA）</div>
                <div className="text-xs text-gray-500">いつもの銀行で</div>
                <div className="text-xs text-gray-500">簡単・便利に資産運用</div>
              </div>
            </div>
            <div className="w-12 h-12 flex items-center justify-center">
              <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                <span className="text-pink-500 text-lg">$</span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center">
                <span className="text-xs text-red-500">$</span>
              </div>
              <div>
                <div className="text-sm font-medium">三菱UFJ eスマート証券</div>
                <div className="text-xs text-gray-500">株式含む豊富な商品ラインアップ</div>
                <div className="text-xs text-gray-500">NISAでの取引時手数料が無料</div>
              </div>
            </div>
            <div className="w-12 h-12 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="flex gap-0.5">
                  <div className="w-2 h-4 bg-green-400"></div>
                  <div className="w-2 h-6 bg-green-400"></div>
                  <div className="w-2 h-8 bg-green-400"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center">
                <span className="text-xs text-yellow-500">:</span>
              </div>
              <div>
                <div className="text-sm font-medium">COIN+（エアウォレット）</div>
              </div>
            </div>
            <div className="w-12 h-12 flex items-center justify-center">
              <div className="w-8 h-10 border-2 border-gray-400 rounded flex items-center justify-center">
                <div className="w-4 h-1 bg-gray-400"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-2 py-2">
        <div className="flex justify-around">
          <button className="flex flex-col items-center py-1 text-red-500">
            <Home className="w-5 h-5" />
            <span className="text-xs mt-1">ホーム</span>
          </button>
          <button className="flex flex-col items-center py-1 text-gray-400">
            <Building2 className="w-5 h-5" />
            <span className="text-xs mt-1">口座一覧</span>
          </button>
          <button className="flex flex-col items-center py-1 text-gray-400">
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-xs mt-1">振込・振替</span>
          </button>
          <button className="flex flex-col items-center py-1 text-gray-400">
            <Settings className="w-5 h-5" />
            <span className="text-xs mt-1">サービス</span>
          </button>
          <button className="flex flex-col items-center py-1 text-gray-400">
            <User className="w-5 h-5" />
            <span className="text-xs mt-1">マイページ</span>
          </button>
        </div>
      </div>
    </div>
  )

  const MeisaiScreen = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <button onClick={() => setCurrentScreen('home')} className="text-gray-600">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-base font-medium">入出金明細</span>
        <HelpCircle className="w-6 h-6 text-red-500" />
      </div>

      <div className="bg-white px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-gray-700">{accountInfo.branchName}</div>
            <div className="text-xs text-gray-500">{accountInfo.accountType} {accountInfo.accountNumber} (Eco通帳)</div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold">{accountInfo.balance.toLocaleString()}</span>
            <span className="text-sm ml-1">円</span>
          </div>
        </div>
      </div>

      <div className="bg-white mx-4 mt-2 p-3 rounded-lg border border-gray-200">
        <div className="text-xs text-gray-600 mb-2">
          表示条件：{getDateRange()}, {getTypeLabel()}
        </div>
        <button 
          onClick={() => setCurrentScreen('date')}
          className="w-full py-2 border border-gray-300 rounded-full flex items-center justify-center gap-2 text-sm"
        >
          <Search className="w-4 h-4" />
          口座・期間等を変更
        </button>
      </div>

      <div className="bg-white mx-4 mt-3 px-3 py-2 flex items-center justify-end gap-2">
        <span className="text-xs text-gray-500">取引後残高</span>
        <button 
          onClick={() => setShowBalanceAfter(!showBalanceAfter)}
          className={`w-12 h-6 rounded-full transition-colors ${showBalanceAfter ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${showBalanceAfter ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-white mx-4 mt-2 rounded-t-lg">
        {(() => {
          const filteredTx = getFilteredTransactions()
          let lastYear: number | null = null
          return filteredTx.map((tx) => {
            const txYear = getTxDate(tx).getFullYear()
            const showYearHeader = txYear !== lastYear
            lastYear = txYear
            return (
              <div key={tx.id}>
                {showYearHeader && (
                  <div className="px-4 py-2 bg-gray-100 text-sm font-medium text-gray-700">
                    {txYear}年
                  </div>
                )}
                <div className="relative overflow-hidden border-b border-gray-100">
                  <div 
                    className={`px-4 py-4 cursor-pointer hover:bg-gray-50 select-none bg-white transition-transform duration-200 ${swipedItemId === tx.id ? 'translate-x-16' : 'translate-x-0'}`}
                    onContextMenu={(e) => handleContextMenu(e, tx)}
                    onTouchStart={(e) => handleSwipeTouchStart(e)}
                    onTouchMove={(e) => handleSwipeTouchMove(e, tx.id)}
                    onTouchEnd={handleSwipeTouchEnd}
                  >
                    <div className="text-sm text-gray-600">
                      {tx.date.replace(/^(\d+)\//, (_, m) => m.padStart(2, '0') + '/')}{'\u3000'}{tx.type}{tx.description ? `｜${tx.description}` : ''}
                    </div>
                    <div className={`text-right text-lg font-medium mt-1 ${tx.amount < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                      {formatAmount(tx.amount)}<span className="text-sm">円</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTransaction(tx.id)}
                    className={`absolute left-0 top-0 bottom-0 w-16 bg-red-500 flex items-center justify-center text-white text-2xl font-bold transition-opacity duration-200 ${swipedItemId === tx.id ? 'opacity-100' : 'opacity-0'}`}
                  >
                    -
                  </button>
                </div>
              </div>
            )
          })
        })()}
        
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 mx-4 max-w-sm w-full shadow-xl">
              <div className="text-lg font-medium mb-4 text-center">データを削除しますか？</div>
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600 mb-1">
                  {deleteConfirm.date}{'\u3000'}{deleteConfirm.type}{deleteConfirm.description ? `｜${deleteConfirm.description}` : ''}
                </div>
                <div className={`text-right text-lg font-medium ${deleteConfirm.amount < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                  {formatAmount(deleteConfirm.amount)}<span className="text-sm">円</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
                >
                  キャンセル
                </button>
                <button 
                  onClick={() => deleteTransaction(deleteConfirm.id)}
                  className="flex-1 py-3 bg-red-500 text-white rounded-lg font-medium"
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="px-4 py-2 text-right text-xs text-gray-500">
          {currentTime} 現在
        </div>
      </div>

      <div className="bg-white mx-4 mb-4 rounded-b-lg">
        <button className="w-full px-4 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">📋</span>
            <span className="text-sm">振り込みの明細を確認したい</span>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </button>
        <button className="w-full px-4 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">🕐</span>
            <span className="text-sm">2年より前の明細を確認したい</span>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </div>
  )

  const DateScreen = () => (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <button onClick={() => setCurrentScreen('meisai')} className="text-gray-600">
          <X className="w-6 h-6" />
        </button>
        <span className="text-base font-medium">口座・期間等を変更</span>
        <button 
          onClick={() => setShowAddTransaction(!showAddTransaction)}
          className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">口座</div>
          <div className="bg-white rounded-lg border-2 border-red-500 p-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              </div>
              <div>
                <div className="text-sm font-medium">{accountInfo.branchName}</div>
                <div className="text-xs text-gray-500">{accountInfo.accountType}{'\u3000'}{accountInfo.accountNumber}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">表示期間</div>
          <div className="space-y-2">
            {[
              { id: 'all', label: '全期間' },
              { id: '30days', label: '直近30日間' },
              { id: 'thisMonth', label: '今月' },
              { id: 'lastMonth', label: '前月' },
              { id: 'custom', label: '期間設定' },
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id)}
                className={`w-full bg-white rounded-lg p-4 flex items-center gap-3 ${
                  selectedPeriod === period.id ? 'border-2 border-red-500' : 'border border-gray-200'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPeriod === period.id ? 'border-red-500' : 'border-gray-300'
                }`}>
                  {selectedPeriod === period.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  )}
                </div>
                <span className="text-sm">{period.label}</span>
              </button>
            ))}
          </div>
          
          {selectedPeriod === 'custom' && (
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1">
                <div className="text-sm text-gray-700 mb-1">開始日</div>
                <input
                  type="text"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm"
                  placeholder="2025/11/28"
                />
              </div>
              <span className="text-gray-500 mt-6">〜</span>
              <div className="flex-1">
                <div className="text-sm text-gray-700 mb-1">終了日</div>
                <input
                  type="text"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm"
                  placeholder="2025/12/27"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">取引種別</div>
          <div className="flex gap-2">
            {[
              { id: 'all', label: '全取引' },
              { id: 'deposit', label: '入金' },
              { id: 'withdraw', label: '出金' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`flex-1 py-3 rounded-lg border flex flex-col items-center ${
                  selectedType === type.id ? 'border-red-500' : 'border-gray-200'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mb-1 ${
                  selectedType === type.id ? 'border-red-500' : 'border-gray-300'
                }`}>
                  {selectedType === type.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  )}
                </div>
                <span className="text-sm">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {showAddTransaction && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">取引明細を追加</div>
            <div className="mt-3 bg-white rounded-lg p-4 border border-gray-200 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-gray-600 mb-1 block">月</label>
                  <select
                    value={newTransaction.month}
                    onChange={(e) => setNewTransaction({...newTransaction, month: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base appearance-none bg-white"
                  >
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-600 mb-1 block">日</label>
                  <select
                    value={newTransaction.day}
                    onChange={(e) => setNewTransaction({...newTransaction, day: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base appearance-none bg-white"
                  >
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}日</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">取引種別</label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base appearance-none bg-white"
                >
                  <option value="振込">振込</option>
                  <option value="振込2">振込2</option>
                  <option value="電話">電話</option>
                  <option value="カード">カード</option>
                  <option value="ATM">ATM</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">摘要</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
                  placeholder="例: カ）エヌイーエフコミュニケーシ"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">金額</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newTransaction.amount || ''}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={() => setNewTransaction({...newTransaction, isExpense: !newTransaction.isExpense})}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-lg border-2 transition-colors ${
                  newTransaction.isExpense ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                <span className="text-base font-medium">{newTransaction.isExpense ? '出金（マイナス表示）' : '入金（プラス表示）'}</span>
                <div className={`w-12 h-7 rounded-full transition-colors flex items-center ${
                  newTransaction.isExpense ? 'bg-red-500 justify-end' : 'bg-gray-300 justify-start'
                }`}>
                  <div className="w-6 h-6 bg-white rounded-full shadow mx-0.5" />
                </div>
              </button>
              <button
                onClick={addTransaction}
                className="w-full bg-red-500 text-white py-4 rounded-lg text-base font-medium active:bg-red-600"
              >
                追加する
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-4 border-t border-gray-200 flex gap-3">
        <button 
          onClick={() => setCurrentScreen('meisai')}
          className="flex-1 py-3 border border-gray-300 rounded-lg text-sm font-medium"
        >
          キャンセル
        </button>
        <button 
          onClick={() => setCurrentScreen('meisai')}
          className="flex-1 py-3 bg-gray-400 text-white rounded-lg text-sm font-medium"
        >
          設定する
        </button>
      </div>
    </div>
  )

  return (
    <div className="w-full bg-gray-100 min-h-screen">
      {currentScreen === 'home' && <HomeScreen />}
      {currentScreen === 'meisai' && <MeisaiScreen />}
      {currentScreen === 'date' && <DateScreen />}
    </div>
  )
}

export default App
