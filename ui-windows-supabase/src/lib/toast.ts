/**
 * toast.ts - Simple toast notification system
 * Provides error and success notifications for API failures
 */

interface ToastOptions {
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
  duration?: number
}

class ToastManager {
  private toasts: Map<string, HTMLElement> = new Map()
  private container: HTMLElement | null = null

  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.id = 'toast-container'
      this.container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm'
      document.body.appendChild(this.container)
    }
    return this.container
  }

  private createToast(options: ToastOptions): HTMLElement {
    const toast = document.createElement('div')
    const id = `toast-${Date.now()}-${Math.floor(performance.now() * 1000)}`

    const bgColor = {
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
    }[options.type]

    const icon = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    }[options.type]

    toast.className = `${bgColor} border rounded-lg p-4 shadow-lg animate-in slide-in-from-right duration-300`
    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="text-lg">${icon}</span>
        <div class="flex-1">
          <h4 class="font-medium text-sm">${options.title}</h4>
          ${options.description ? `<p class="text-sm mt-1 opacity-80">${options.description}</p>` : ''}
        </div>
        <button class="toast-close text-lg hover:opacity-70 transition-opacity" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `

    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0'
        toast.style.transform = 'translateX(100%)'
        setTimeout(() => toast.remove(), 300)
      }
    }, options.duration || 5000)

    this.toasts.set(id, toast)
    return toast
  }

  show(options: ToastOptions) {
    const container = this.ensureContainer()
    const toast = this.createToast(options)
    container.appendChild(toast)
  }

  success(title: string, description?: string) {
    this.show({ type: 'success', title, description })
  }

  error(title: string, description?: string) {
    this.show({ type: 'error', title, description })
  }

  info(title: string, description?: string) {
    this.show({ type: 'info', title, description })
  }

  warning(title: string, description?: string) {
    this.show({ type: 'warning', title, description })
  }

  clear() {
    this.toasts.forEach(toast => toast.remove())
    this.toasts.clear()
  }
}

export const toast = new ToastManager()

// Convenience functions for common use cases
export const showError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  toast.error('Error', message)
}

export const showSuccess = (message: string) => {
  toast.success('Success', message)
}

export const showApiError = (operation: string, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Operation failed'
  toast.error(`${operation} Failed`, message)
}

// Add global styles for animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slide-in-from-right {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .animate-in {
      animation-fill-mode: both;
    }

    .slide-in-from-right {
      animation-name: slide-in-from-right;
    }

    .duration-300 {
      animation-duration: 300ms;
    }
  `

  document.head.appendChild(style)
}