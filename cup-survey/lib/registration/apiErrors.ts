import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getRegistrationPublicErrorMessage, formatRegistrationLimitMessage } from './publicErrorMessages'
import { RegistrationClosedError, RegistrationLimitError } from './service'

export function registrationApiErrorResponse(error: unknown): NextResponse {
  if (error instanceof RegistrationClosedError) {
    return NextResponse.json(
      { errors: [getRegistrationPublicErrorMessage('REGISTRATION_CLOSED')] },
      { status: 403 },
    )
  }

  if (error instanceof RegistrationLimitError) {
    return NextResponse.json(
      { errors: [formatRegistrationLimitMessage(error.maxAthletes)] },
      { status: 409 },
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return NextResponse.json({ errors: ['Такая категория уже добавлена'] }, { status: 400 })
  }

  if (error instanceof Error) {
    if (error.message === 'CLUB_NOT_FOUND') {
      return NextResponse.json(
        { errors: ['Выбранный клуб не найден. Выберите клуб из списка снова.'] },
        { status: 400 },
      )
    }
    if (error.message === 'CLUB_REQUIRED') {
      return NextResponse.json({ errors: ['Укажите клуб'] }, { status: 400 })
    }
    if (error.message === 'CLUB_CREATE_FAILED') {
      return NextResponse.json(
        { errors: ['Не удалось сохранить клуб. Попробуйте ещё раз.'] },
        { status: 400 },
      )
    }
  }

  console.error(error)
  return NextResponse.json(
    { errors: [getRegistrationPublicErrorMessage('INTERNAL_ERROR')] },
    { status: 500 },
  )
}
