import { NextResponse } from 'next/server'
import {
  BracketOperationError,
  DraftConflictError,
  PublishValidationError,
  VersionConflictError,
} from './core/errors'
import {
  BoutsConfigurationError,
  BoutsPageSettingMissingError,
  BoutsSchedulerError,
  BoutsValidationError,
  MatCountDemotionConfirmationRequiredError,
  PinCascadeConfirmationRequiredError,
} from '../bouts/errors'
import { AwardsOperationError, AwardsPageSettingMissingError } from '../awards/errors'
import { apiErrorResponse } from '../http/apiErrorResponse'
import { ImpactChangedError } from './live/errors'

export function bracketErrorResponse(error: unknown) {
  if (error instanceof AwardsOperationError) {
    return NextResponse.json(
      { code: error.code, error: error.message },
      { status: error.httpStatus },
    )
  }
  if (error instanceof AwardsPageSettingMissingError) {
    console.error('Awards settings missing', error)
    return NextResponse.json(
      { code: error.code, error: error.message },
      { status: 500 },
    )
  }
  if (error instanceof BoutsConfigurationError) {
    return NextResponse.json(
      { errors: [{ code: error.code, message: error.message }] },
      { status: 422 },
    )
  }
  if (error instanceof BoutsPageSettingMissingError) {
    console.error('Bouts settings missing', error)
    return NextResponse.json(
      { errors: [{ code: error.code, message: error.message }] },
      { status: 500 },
    )
  }
  if (error instanceof DraftConflictError) {
    return NextResponse.json({ code: error.code, error: error.message }, { status: 409 })
  }
  if (error instanceof VersionConflictError) {
    return NextResponse.json({ code: error.code, error: error.message }, { status: 409 })
  }
  if (error instanceof ImpactChangedError) {
    return NextResponse.json(
      {
        code: error.code,
        error: error.message,
        actualImpact: error.actualImpact,
      },
      { status: 409 },
    )
  }
  if (error instanceof PinCascadeConfirmationRequiredError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        cascadeBoutIds: error.cascadeBoutIds,
      },
      { status: 409 },
    )
  }
  if (error instanceof MatCountDemotionConfirmationRequiredError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        demotionToken: error.demotionToken,
        demotedFixedMats: error.demotedFixedMats,
        demotedCategoryCount: error.demotedCategoryCount,
        draftEntries: error.draftEntries,
        publishedEntries: error.publishedEntries,
      },
      { status: 409 },
    )
  }
  if (error instanceof BoutsValidationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
  }
  if (error instanceof BoutsSchedulerError) {
    const status =
      error.code === 'BOUTS_SCHEDULE_CORRUPT'
        ? 500
        : error.code === 'BOUT_NOT_READY' ||
            error.code === 'BOUT_EXECUTION_OUT_OF_ORDER' ||
            error.code === 'UNDO_WHILE_BOUT_IN_PROGRESS' ||
            error.code === 'SCHEDULE_VERSION_CONFLICT'
          ? 409
          : 422
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  if (error instanceof PublishValidationError) {
    return NextResponse.json({ errors: error.errors }, { status: 422 })
  }
  if (error instanceof BracketOperationError) {
    if (
      error.code === 'CONSOLIDATION_PLAN_CHANGED' ||
      error.code === 'CONSOLIDATION_POLICY_MISMATCH'
    ) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { errors: [{ code: error.code, message: error.message }] },
      { status: 422 },
    )
  }
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'PrismaClientValidationError'
  ) {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : ''
    if (message.includes('BracketMoveAction') || message.includes('CONSOLIDATION')) {
      console.error('Bracket API error: stale Prisma client or schema', error)
      return NextResponse.json(
        {
          error:
            'Схема базы или Prisma-клиент устарели. Выполните `npm run db:deploy && npm run db:generate` и перезапустите dev-сервер.',
        },
        { status: 503 },
      )
    }
  }
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'PrismaClientInitializationError'
  ) {
    console.error('Bracket API error: database unavailable', error)
    return NextResponse.json(
      {
        error:
          'База данных недоступна. Запустите PostgreSQL (docker compose up -d) и перезапустите dev-сервер.',
      },
      { status: 503 },
    )
  }

  console.error('Bracket API error', error)
  return apiErrorResponse(error)
}
