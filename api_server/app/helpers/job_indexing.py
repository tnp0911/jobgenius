import asyncio
import logging

from app.db.arq import get_arq_pool
from app.services.job_service import store_jobs_to_pinecone

logger = logging.getLogger(__name__)


async def index_jobs_in_background(jobs: list) -> None:
    """Enqueue Pinecone indexing; never raise to the caller on ARQ/Redis failures."""
    if not jobs:
        return
    try:
        pool = get_arq_pool()
        await pool.enqueue_job("store_jobs_to_pinecone_arq", jobs)
    except RuntimeError:
        # Worker process or tests: no API ARQ pool — index directly
        try:
            await store_jobs_to_pinecone(jobs)
        except Exception:
            logger.exception("Direct Pinecone indexing failed")
    except asyncio.CancelledError:
        logger.warning("ARQ enqueue cancelled; jobs were not indexed")
        raise
    except Exception:
        logger.exception("Failed to enqueue jobs for Pinecone indexing")


def schedule_job_indexing(jobs: list) -> None:
    """
    Fire-and-forget indexing so HTTP handlers can return jobs immediately.

    A client disconnect must not fail the recommendation response after search_jobs_with_jsearch has already succeeded.
    """
    if not jobs:
        return

    async def _run() -> None:
        try:
            await index_jobs_in_background(jobs)
        except asyncio.CancelledError:
            logger.warning("Background job indexing task cancelled")
        except Exception:
            logger.exception("Background job indexing failed")

    asyncio.create_task(_run())
