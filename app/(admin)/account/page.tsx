import { requireSession } from '@/lib/session'
import ChangePasswordForm from './ChangePasswordForm'

export default async function AccountPage() {
  await requireSession()
  return (
    <>
      <h1>My Account</h1>
      <ChangePasswordForm />
    </>
  )
}
