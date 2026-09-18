"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { authenticateUser, updateEmployee } from "@/lib/api/supabase-service"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react"

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { user } = useAuth()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const resetForm = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
    setErrorMsg("")
  }

  const handleClose = (newOpenState: boolean) => {
    if (!newOpenState) {
      resetForm()
    }
    onOpenChange(newOpenState)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    if (!user || !user.email) {
      setErrorMsg("User tidak ditemukan.")
      return
    }

    if (!currentPassword) {
      setErrorMsg("Password saat ini wajib diisi.")
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg("Password baru minimal 6 karakter.")
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Konfirmasi password baru tidak cocok.")
      return
    }

    if (currentPassword === newPassword) {
      setErrorMsg("Password baru harus berbeda dengan password saat ini.")
      return
    }

    setIsSubmitting(true)

    try {
      // Step 1: Verify current password
      const authResult = await authenticateUser(user.email, currentPassword)
      if (!authResult) {
        setErrorMsg("Password saat ini salah.")
        setIsSubmitting(false)
        return
      }

      // Step 2: Update password in DB
      const updated = await updateEmployee(user.id, { password: newPassword })
      if (!updated) {
        setErrorMsg("Gagal merubah password. Silakan coba lagi.")
        setIsSubmitting(false)
        return
      }

      toast.success("Password kamu berhasil diperbarui.")

      handleClose(false)
    } catch (err) {
      console.error("Error updating password:", err)
      setErrorMsg("Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Ganti Password
          </DialogTitle>
          <DialogDescription>
            Masukkan password kamu saat ini dan buat password baru.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive border border-destructive/20 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="current-password">Password Saat Ini</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Masukkan password saat ini"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password Baru</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Minimal 6 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Password"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
