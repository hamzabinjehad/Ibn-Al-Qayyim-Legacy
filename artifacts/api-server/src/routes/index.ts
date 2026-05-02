import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { booksRouter } from "./books";
import { annotationsRouter } from "./annotations";
import { searchRouter } from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(annotationsRouter);
router.use(searchRouter);

export default router;
