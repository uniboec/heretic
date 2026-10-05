-- Schema-only: add time-weighted auto mat assign modes.
ALTER TYPE "AutoMatAssignMode" ADD VALUE 'BY_CATEGORY_TIME';
ALTER TYPE "AutoMatAssignMode" ADD VALUE 'BY_BOUT_TIME';
