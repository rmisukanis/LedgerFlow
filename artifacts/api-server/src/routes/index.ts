import { Router, type IRouter } from "express";
import healthRouter from "./health";
import qbRouter from "./qb";
import qbExplorerRouter from "./qb-explorer";
import qbDocumentsRouter from "./qb-documents";
import qbAuditRouter from "./qb-audit";
import invoicesRouter from "./invoices";
import apiExplorerRouter from "./api-explorer";
import apiCollectionsRouter from "./api-collections";
import transactionsRouter from "./transactions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(qbRouter);
router.use(qbExplorerRouter);
router.use(qbDocumentsRouter);
router.use(qbAuditRouter);
router.use(invoicesRouter);
router.use(apiExplorerRouter);
router.use(apiCollectionsRouter);
router.use(transactionsRouter);

export default router;
